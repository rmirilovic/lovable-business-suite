import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { recordLoginAudit, updateLoginAuditCompany } from "@/lib/loginAuditLogger";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Company {
  id: string;
  name: string;
  code: string;
}

interface BusinessYear {
  id: string;
  year: number;
  company_id: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialLoadDone: boolean;
  companies: Company[];
  businessYears: BusinessYear[];
  selectedCompany: Company | null;
  selectedYear: BusinessYear | null;
  userRole: AppRole | null;
  isSuperAdmin: boolean;
  isLocalAdmin: boolean;
  localAdminCompanyIds: string[];
  setSelectedCompany: (company: Company | null) => void;
  setSelectedYear: (year: BusinessYear | null) => void;
  refreshAuthState: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [accessibleCompanyIds, setAccessibleCompanyIds] = useState<string[]>([]);
  const [businessYears, setBusinessYears] = useState<BusinessYear[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedYear, setSelectedYear] = useState<BusinessYear | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(() => {
    const cached = localStorage.getItem("cachedUserRole");
    return cached ? (cached as AppRole) : null;
  });
  const [localAdminCompanyIds, setLocalAdminCompanyIds] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem("cachedLocalAdminCompanyIds");
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const intentionalSignOutRef = useRef(false);
  const mountTimeRef = useRef(Date.now());
  const initialLoadDoneRef = useRef(false);
  const userDataLoadingRef = useRef(false);
  const userRoleRef = useRef<AppRole | null>(userRole);
  const localAdminCompanyIdsRef = useRef<string[]>(localAdminCompanyIds);
  const accessibleCompanyIdsRef = useRef<string[]>(accessibleCompanyIds);
  const pendingSignOutCheckRef = useRef<number | null>(null);
  const signedOutPermanentlyRef = useRef(false);
  const superAdminRecoveryInFlightRef = useRef(false);

  const updateInitialLoadDone = (value: boolean) => {
    initialLoadDoneRef.current = value;
    setInitialLoadDone(value);
  };

  useEffect(() => {
    userRoleRef.current = userRole;
  }, [userRole]);

  useEffect(() => {
    localAdminCompanyIdsRef.current = localAdminCompanyIds;
  }, [localAdminCompanyIds]);

  useEffect(() => {
    accessibleCompanyIdsRef.current = accessibleCompanyIds;
  }, [accessibleCompanyIds]);

  const cancelPendingSignOutCheck = () => {
    if (pendingSignOutCheckRef.current) {
      window.clearTimeout(pendingSignOutCheckRef.current);
      pendingSignOutCheckRef.current = null;
    }
  };

  const applySessionState = (nextSession: Session | null) => {
    if (nextSession?.user) {
      cancelPendingSignOutCheck();
    }
    sessionRef.current = nextSession;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  };

  const isSuperAdmin = userRole === "super_admin";
  const isLocalAdmin = localAdminCompanyIds.length > 0;

  const applyCompanySelection = async (companiesData: Company[], allowedCompanyIds: string[] = []) => {
    setCompanies(companiesData);

    if (companiesData.length === 0) {
      setSelectedCompany(null);
      setBusinessYears([]);
      setSelectedYear(null);
      localStorage.removeItem("selectedCompanyId");
      localStorage.removeItem("selectedYearId");
      return;
    }

    const savedCompanyId = localStorage.getItem("selectedCompanyId");
    const savedCompanyAllowed =
      !!savedCompanyId && (allowedCompanyIds.length === 0 || allowedCompanyIds.includes(savedCompanyId));
    const savedCompany = savedCompanyAllowed
      ? companiesData.find((company) => company.id === savedCompanyId)
      : undefined;
    const fallbackCompany =
      (allowedCompanyIds.length > 0
        ? companiesData.find((company) => allowedCompanyIds.includes(company.id))
        : companiesData[0]) ?? companiesData[0];
    const nextCompany = savedCompany ?? fallbackCompany;

    if (!savedCompany && savedCompanyId) {
      localStorage.removeItem("selectedCompanyId");
    }

    setSelectedCompany(nextCompany);
    await fetchBusinessYears(nextCompany.id);
  };

  const fetchUserRole = async (userId: string): Promise<AppRole | null> => {
    const previousRole = userRoleRef.current;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      console.error("[AuthContext] Failed to fetch user role, keeping previous role state:", error);

      if (!previousRole) {
        const recovered = await resolveSuperAdminFallback(userId);
        if (recovered) {
          localStorage.setItem("cachedUserRole", "super_admin");
          return "super_admin";
        }
      }

      return previousRole;
    }

    if (!data || data.length === 0) {
      const recovered = await resolveSuperAdminFallback(userId);
      if (recovered) {
        localStorage.setItem("cachedUserRole", "super_admin");
        return "super_admin";
      }

      if (previousRole && sessionRef.current?.user?.id === userId) {
        console.warn("[AuthContext] Empty role result while session is active, preserving cached role state");
        return previousRole;
      }

      setUserRole(null);
      localStorage.removeItem("cachedUserRole");
      return null;
    }

    const roles = data.map((item) => item.role as AppRole);

    if (roles.includes("super_admin")) {
      setUserRole("super_admin");
      localStorage.setItem("cachedUserRole", "super_admin");
      return "super_admin";
    }

    const nextRole = roles[0] ?? null;
    setUserRole(nextRole);
    if (nextRole) localStorage.setItem("cachedUserRole", nextRole);
    else localStorage.removeItem("cachedUserRole");
    return nextRole;
  };

  const fetchLocalAdminCompanies = async (userId: string): Promise<string[]> => {
    const previousCompanyIds = localAdminCompanyIdsRef.current;
    const { data, error } = await supabase
      .from("user_companies")
      .select("company_id")
      .eq("user_id", userId)
      .eq("is_local_admin", true);

    if (error) {
      console.error("[AuthContext] Failed to fetch local admin companies, keeping previous admin state:", error);
      return previousCompanyIds;
    }

    const companyIds = (data ?? []).map((d) => d.company_id);

    if (companyIds.length === 0 && previousCompanyIds.length > 0 && sessionRef.current?.user?.id === userId) {
      console.warn("[AuthContext] Empty local admin result while session is active, preserving cached admin companies");
      return previousCompanyIds;
    }

    setLocalAdminCompanyIds(companyIds);

    if (companyIds.length > 0) {
      localStorage.setItem("cachedLocalAdminCompanyIds", JSON.stringify(companyIds));
    } else {
      localStorage.removeItem("cachedLocalAdminCompanyIds");
    }

    return companyIds;
  };

  const fetchAccessibleCompanyIds = async (userId: string): Promise<string[]> => {
    const previousCompanyIds = accessibleCompanyIdsRef.current;
    const { data, error } = await supabase
      .from("user_role_assignments")
      .select("company_id")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error) {
      console.error("[AuthContext] Failed to fetch accessible companies, keeping previous company scope:", error);
      return previousCompanyIds;
    }

    const companyIds = data ? [...new Set(data.map((item) => item.company_id))] : [];
    setAccessibleCompanyIds(companyIds);
    return companyIds;
  };

  const resolveSuperAdminFallback = async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    setUserRole("super_admin");
    return true;
  };

  const resetAuthState = () => {
    cancelPendingSignOutCheck();
    userDataLoadingRef.current = false;
    setCompanies([]);
    setBusinessYears([]);
    setSelectedCompany(null);
    setSelectedYear(null);
    setUserRole(null);
    setLocalAdminCompanyIds([]);
    setAccessibleCompanyIds([]);
    updateInitialLoadDone(false);
    localStorage.removeItem("cachedUserRole");
    localStorage.removeItem("cachedLocalAdminCompanyIds");
  };

  const loadUserData = async (userId: string) => {
    if (initialLoadDoneRef.current || userDataLoadingRef.current) return;

    userDataLoadingRef.current = true;

    try {
      const [nextUserRole, , roleCompanyIds] = await Promise.all([
        fetchUserRole(userId),
        fetchLocalAdminCompanies(userId),
        fetchAccessibleCompanyIds(userId),
      ]);

      await fetchUserCompanies(userId, nextUserRole === "super_admin", roleCompanyIds);

      updateInitialLoadDone(true);
    } finally {
      userDataLoadingRef.current = false;
      setLoading(false);
    }
  };

  const refreshAuthState = async () => {
    const currentUserId = sessionRef.current?.user?.id ?? user?.id;
    if (!currentUserId || userDataLoadingRef.current) return;

    updateInitialLoadDone(false);
    setLoading(true);
    await loadUserData(currentUserId);
  };

  useEffect(() => {
    let isMounted = true;
    let initialSessionChecked = false;
    let handoffTimeout: number | null = null;
    let awaitingHandoff = false;

    const origin = window.location.origin;

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("erp_session_sync");
    } catch {
      // BroadcastChannel not supported in some environments
    }

    const handleSessionRequest = async () => {
      const {
        data: { session: freshSession },
      } = await supabase.auth.getSession();
      if (freshSession?.access_token && freshSession?.refresh_token) {
        const payload = {
          type: "SESSION_RESPONSE",
          payload: {
            access_token: freshSession.access_token,
            refresh_token: freshSession.refresh_token,
          },
        };
        bc?.postMessage(payload);
      }
    };

    const handleSessionResponse = (access_token: string, refresh_token: string) => {
      if (signedOutPermanentlyRef.current) return;
      awaitingHandoff = false;
      if (handoffTimeout) {
        window.clearTimeout(handoffTimeout);
        handoffTimeout = null;
      }
      setLoading(true);
      void supabase.auth.setSession({ access_token, refresh_token });
    };

    if (bc) {
      bc.onmessage = (event: MessageEvent) => {
        const msg = event.data as any;
        if (msg?.type === "REQUEST_SESSION") {
          void handleSessionRequest();
          return;
        }
        if (msg?.type === "SESSION_RESPONSE" && msg?.payload?.access_token && msg?.payload?.refresh_token) {
          handleSessionResponse(msg.payload.access_token, msg.payload.refresh_token);
          return;
        }
      };
    }

    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const msg = event.data as any;

      if (msg?.type === "REQUEST_SESSION") {
        supabase.auth.getSession().then(({ data: { session: freshSession } }) => {
          if (freshSession?.access_token && freshSession?.refresh_token && event.source) {
            (event.source as Window).postMessage(
              {
                type: "SESSION_RESPONSE",
                payload: {
                  access_token: freshSession.access_token,
                  refresh_token: freshSession.refresh_token,
                },
              },
              origin
            );
          }
        });
        return;
      }

      if (msg?.type === "SESSION_RESPONSE" && msg?.payload?.access_token && msg?.payload?.refresh_token) {
        handleSessionResponse(msg.payload.access_token, msg.payload.refresh_token);
        return;
      }
    };

    window.addEventListener("message", messageHandler);

    const triggerHandoffRescue = (timeSinceMount: number) => {
      console.log("[AuthContext] SIGNED_OUT likely from revoked token - attempting handoff rescue, timeSinceMount:", timeSinceMount);
      awaitingHandoff = true;
      setLoading(true);
      bc?.postMessage({ type: "REQUEST_SESSION" });
      if (window.opener) {
        try {
          window.opener.postMessage({ type: "REQUEST_SESSION" }, origin);
        } catch {
          // ignore
        }
      }
      handoffTimeout = window.setTimeout(() => {
        awaitingHandoff = false;
        if (!isMounted) return;
        console.log("[AuthContext] Handoff rescue timeout - signing out");
        applySessionState(null);
        resetAuthState();
        setLoading(false);
      }, 4000);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      console.log(
        "[AuthContext] onAuthStateChange:",
        event,
        "user:",
        !!nextSession?.user,
        "initialSessionChecked:",
        initialSessionChecked,
        "awaitingHandoff:",
        awaitingHandoff,
        "initialLoadDone:",
        initialLoadDoneRef.current,
        "userDataLoading:",
        userDataLoadingRef.current
      );

      if (awaitingHandoff && !nextSession?.user) {
        setLoading(true);
        return;
      }

      if (nextSession?.user) {
        cancelPendingSignOutCheck();
      }

      if (event === "TOKEN_REFRESHED") {
        applySessionState(nextSession);
        // Token was refreshed — session/user refs are already updated above.
        // Do NOT re-run loadUserData; role & permission state is still valid.
        console.log("[AuthContext] TOKEN_REFRESHED — keeping existing role state");
        return;
      }

      if (event === "SIGNED_OUT") {
        if (!intentionalSignOutRef.current) {
          cancelPendingSignOutCheck();
          pendingSignOutCheckRef.current = window.setTimeout(() => {
            pendingSignOutCheckRef.current = null;

            void supabase.auth.getSession().then(({ data: { session: freshSession } }) => {
              if (!isMounted) return;

              if (freshSession?.user) {
                console.log("[AuthContext] Ignoring transient SIGNED_OUT because session is still active");
                applySessionState(freshSession);

                if (!initialLoadDoneRef.current && !userDataLoadingRef.current) {
                  setLoading(true);
                  void loadUserData(freshSession.user.id);
                } else {
                  setLoading(false);
                }

                return;
              }

              const timeSinceMount = Date.now() - mountTimeRef.current;
              if (timeSinceMount < 15000 && !awaitingHandoff) {
                triggerHandoffRescue(timeSinceMount);
                return;
              }

              applySessionState(null);
              intentionalSignOutRef.current = false;
              resetAuthState();
              setLoading(false);
            });
          }, 2500);

          return;
        }

        intentionalSignOutRef.current = false;
        applySessionState(null);
        resetAuthState();
        setLoading(false);
        return;
      }

      applySessionState(nextSession);

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (nextSession?.user) {
          if (!initialLoadDoneRef.current && !userDataLoadingRef.current) {
            setLoading(true);
            void loadUserData(nextSession.user.id);
          }
        } else if (initialSessionChecked) {
          setLoading(false);
        }
        return;
      }

      if (nextSession?.user && !initialLoadDoneRef.current && !userDataLoadingRef.current) {
        setLoading(true);
        void loadUserData(nextSession.user.id);
        return;
      }
      if (initialSessionChecked) {
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;

      console.log("[AuthContext] getSession result:", "user:", !!initialSession?.user, "initialLoadDone:", initialLoadDoneRef.current);

      initialSessionChecked = true;
      applySessionState(initialSession);

      if (!initialSession?.user) {
        awaitingHandoff = true;
        setLoading(true);

        console.log("[AuthContext] No session found, requesting handoff...");

        bc?.postMessage({ type: "REQUEST_SESSION" });

        if (window.opener) {
          try {
            window.opener.postMessage({ type: "REQUEST_SESSION" }, origin);
          } catch {
            // ignore
          }
        }

        handoffTimeout = window.setTimeout(() => {
          awaitingHandoff = false;
          if (!isMounted) return;
          console.log("[AuthContext] Handoff timeout - no session received");
          setLoading(false);
        }, 4000);
      }
      // Note: loading=false is handled by loadUserData() called from onAuthStateChange
      // If session exists, INITIAL_SESSION event will trigger loadUserData which sets loading=false
      // If no session and no handoff, the timeout above sets loading=false
    });

    return () => {
      isMounted = false;
      cancelPendingSignOutCheck();
      if (handoffTimeout) window.clearTimeout(handoffTimeout);
      window.removeEventListener("message", messageHandler);
      bc?.close();
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserCompanies = async (
    userId: string,
    isUserSuperAdmin: boolean,
    roleCompanyIds: string[] = []
  ): Promise<boolean> => {
    if (isUserSuperAdmin) {
      const { data: companiesData, error } = await supabase
        .from("companies")
        .select("id, name, code")
        .order("code");

      if (!error && companiesData) {
        await applyCompanySelection(companiesData);
        return true;
      }

      setCompanies([]);
      return false;
    }

    const { data: companyAssignments, error } = await supabase
      .from("user_companies")
      .select(`
        company_id,
        companies (
          id,
          name,
          code
        )
      `)
      .eq("user_id", userId)
      .order("company_id");

    if (!error && companyAssignments && companyAssignments.length > 0) {
      const companiesData = companyAssignments
        .map((assignment: any) => assignment.companies)
        .filter(Boolean) as Company[];

      await applyCompanySelection(companiesData, roleCompanyIds);
      return true;
    }

    const isFallbackSuperAdmin = await resolveSuperAdminFallback(userId);
    if (isFallbackSuperAdmin) {
      return fetchUserCompanies(userId, true);
    }

    setCompanies([]);
    setSelectedCompany(null);
    setBusinessYears([]);
    setSelectedYear(null);
    return false;
  };

  const fetchBusinessYears = async (companyId: string) => {
    const { data: yearsData, error } = await supabase
      .from("business_years")
      .select("id, year, company_id")
      .eq("company_id", companyId)
      .order("year", { ascending: false });

    if (!error && yearsData) {
      setBusinessYears(yearsData);

      const savedYearId = localStorage.getItem("selectedYearId");
      const savedYear = yearsData.find((y) => y.id === savedYearId);

      if (savedYear) {
        setSelectedYear(savedYear);
      } else if (yearsData.length > 0) {
        setSelectedYear(yearsData[0]);
      }
    }
  };

  useEffect(() => {
    if (selectedCompany) {
      localStorage.setItem("selectedCompanyId", selectedCompany.id);
      void fetchBusinessYears(selectedCompany.id);
      // Update the most recent login audit entry with the selected company
      if (user) {
        void updateLoginAuditCompany(user.id, selectedCompany.id, selectedCompany.name);
      }
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (
      !selectedCompany ||
      isSuperAdmin ||
      isLocalAdmin ||
      accessibleCompanyIds.length === 0 ||
      accessibleCompanyIds.includes(selectedCompany.id)
    ) {
      return;
    }

    const fallbackCompany = companies.find((company) => accessibleCompanyIds.includes(company.id));
    if (fallbackCompany) {
      setSelectedCompany(fallbackCompany);
    }
  }, [selectedCompany, companies, accessibleCompanyIds, isSuperAdmin, isLocalAdmin]);

  useEffect(() => {
    if (selectedYear) {
      localStorage.setItem("selectedYearId", selectedYear.id);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (
      !user?.id ||
      loading ||
      !initialLoadDone ||
      userRole ||
      localAdminCompanyIds.length > 0 ||
      superAdminRecoveryInFlightRef.current
    ) {
      return;
    }

    superAdminRecoveryInFlightRef.current = true;

    void (async () => {
      try {
        const recovered = await resolveSuperAdminFallback(user.id);

        if (!recovered || userDataLoadingRef.current) {
          return;
        }

        updateInitialLoadDone(false);
        setLoading(true);
        await loadUserData(user.id);
      } finally {
        superAdminRecoveryInFlightRef.current = false;
      }
    })();
  }, [user?.id, loading, initialLoadDone, userRole, localAdminCompanyIds.length]);

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error && data?.user) {
      const meta = data.user.user_metadata;
      const fullName = [meta?.first_name, meta?.last_name].filter(Boolean).join(" ") || undefined;
      // Fire and forget - don't block login
      void recordLoginAudit(data.user.id, data.user.email, fullName);
    }
    return { error };
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    intentionalSignOutRef.current = true;
    signedOutPermanentlyRef.current = true;
    cancelPendingSignOutCheck();
    // Always clear local state, even if the API call fails (e.g. session_not_found)
    setUser(null);
    setSession(null);
    sessionRef.current = null;
    resetAuthState();
    localStorage.removeItem("selectedCompanyId");
    localStorage.removeItem("selectedYearId");
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore errors - local state is already cleared
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        initialLoadDone,
        companies,
        businessYears,
        selectedCompany,
        selectedYear,
        userRole,
        isSuperAdmin,
        isLocalAdmin,
        localAdminCompanyIds,
        setSelectedCompany,
        setSelectedYear,
        refreshAuthState,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
