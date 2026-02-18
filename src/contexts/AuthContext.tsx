import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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
  const [businessYears, setBusinessYears] = useState<BusinessYear[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedYear, setSelectedYear] = useState<BusinessYear | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [localAdminCompanyIds, setLocalAdminCompanyIds] = useState<string[]>([]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const isSuperAdmin = userRole === "super_admin";
  const isLocalAdmin = localAdminCompanyIds.length > 0;

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      setUserRole(data.role as AppRole);
    } else {
      setUserRole(null);
    }
  };

  const fetchLocalAdminCompanies = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_companies")
      .select("company_id")
      .eq("user_id", userId)
      .eq("is_local_admin", true);

    if (!error && data) {
      setLocalAdminCompanyIds(data.map((d) => d.company_id));
    } else {
      setLocalAdminCompanyIds([]);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let initialSessionChecked = false;
    let handoffTimeout: number | null = null;
    let awaitingHandoff = false;

    const origin = window.location.origin;

    // --- Session handoff between tabs ---
    // Use BroadcastChannel for cross-tab session sharing (works for right-click "Open in new tab")
    // Falls back to postMessage for iframe/opener scenarios
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("erp_session_sync");
    } catch {
      // BroadcastChannel not supported in some environments
    }

    const handleSessionRequest = async () => {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
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
      awaitingHandoff = false;
      if (handoffTimeout) {
        window.clearTimeout(handoffTimeout);
        handoffTimeout = null;
      }
      setLoading(true);
      void supabase.auth.setSession({ access_token, refresh_token });
    };

    // BroadcastChannel handler
    if (bc) {
      bc.onmessage = (event: MessageEvent) => {
        const msg = event.data as any;
        if (msg?.type === "REQUEST_SESSION") {
          handleSessionRequest();
          return;
        }
        if (msg?.type === "SESSION_RESPONSE" && msg?.payload?.access_token && msg?.payload?.refresh_token) {
          handleSessionResponse(msg.payload.access_token, msg.payload.refresh_token);
          return;
        }
      };
    }

    // postMessage handler (for iframe/opener scenarios)
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

    const loadUserData = async (userId: string) => {
      await Promise.all([
        fetchUserCompanies(userId),
        fetchUserRole(userId),
        fetchLocalAdminCompanies(userId),
      ]);
      setInitialLoadDone(true);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      console.log("[AuthContext] onAuthStateChange:", event, "user:", !!nextSession?.user, "initialSessionChecked:", initialSessionChecked, "awaitingHandoff:", awaitingHandoff);

      sessionRef.current = nextSession;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      // IMPORTANT: prevent redirect-to-login while waiting for session handoff
      if (awaitingHandoff && !nextSession?.user) {
        setLoading(true);
        return;
      }

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (nextSession?.user) {
          // Keep loading=true until user data is fully loaded
          setLoading(true);
          loadUserData(nextSession.user.id);
        } else if (initialSessionChecked) {
          setLoading(false);
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        // If we never completed initial load, this SIGNED_OUT is likely caused by
        // a revoked refresh token in a newly opened tab. Try handoff before giving up.
        if (!initialLoadDone && !awaitingHandoff) {
          console.log("[AuthContext] SIGNED_OUT before initial load - attempting handoff rescue");
          awaitingHandoff = true;
          setLoading(true);
          bc?.postMessage({ type: "REQUEST_SESSION" });
          if (window.opener) {
            try {
              window.opener.postMessage({ type: "REQUEST_SESSION" }, origin);
            } catch { /* ignore */ }
          }
          handoffTimeout = window.setTimeout(() => {
            awaitingHandoff = false;
            if (!isMounted) return;
            console.log("[AuthContext] Handoff rescue timeout - signing out");
            setCompanies([]);
            setBusinessYears([]);
            setSelectedCompany(null);
            setSelectedYear(null);
            setUserRole(null);
            setLocalAdminCompanyIds([]);
            setInitialLoadDone(false);
            setLoading(false);
          }, 4000);
          return;
        }
        setCompanies([]);
        setBusinessYears([]);
        setSelectedCompany(null);
        setSelectedYear(null);
        setUserRole(null);
        setLocalAdminCompanyIds([]);
        setInitialLoadDone(false);
        setLoading(false);
        return;
      }

      // For TOKEN_REFRESHED/USER_UPDATED - load user data if not yet loaded (e.g. session handoff to new tab)
      if (nextSession?.user && !initialLoadDone) {
        setLoading(true);
        loadUserData(nextSession.user.id);
        return;
      }
      if (initialSessionChecked) {
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;

      console.log("[AuthContext] getSession result:", "user:", !!initialSession?.user, "initialLoadDone:", initialLoadDone);

      initialSessionChecked = true;
      sessionRef.current = initialSession;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (!initialSession?.user) {
        // No session - request from other tabs via BroadcastChannel and/or opener
        awaitingHandoff = true;
        setLoading(true);

        console.log("[AuthContext] No session found, requesting handoff...");

        // Try BroadcastChannel first (works for right-click "Open in new tab")
        bc?.postMessage({ type: "REQUEST_SESSION" });

        // Also try opener for iframe scenarios
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
      if (handoffTimeout) window.clearTimeout(handoffTimeout);
      window.removeEventListener("message", messageHandler);
      bc?.close();
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserCompanies = async (userId: string): Promise<boolean> => {
    const { data: companiesData, error } = await supabase
      .from("companies")
      .select("id, name, code");

    if (!error && companiesData) {
      setCompanies(companiesData);
      
      const savedCompanyId = localStorage.getItem("selectedCompanyId");
      const savedCompany = companiesData.find(c => c.id === savedCompanyId);
      
      if (savedCompany) {
        setSelectedCompany(savedCompany);
        await fetchBusinessYears(savedCompany.id);
      } else if (companiesData.length > 0) {
        setSelectedCompany(companiesData[0]);
        await fetchBusinessYears(companiesData[0].id);
      }
      return true;
    }
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
      const savedYear = yearsData.find(y => y.id === savedYearId);
      
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
      fetchBusinessYears(selectedCompany.id);
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (selectedYear) {
      localStorage.setItem("selectedYearId", selectedYear.id);
    }
  }, [selectedYear]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
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
    await supabase.auth.signOut();
    setSelectedCompany(null);
    setSelectedYear(null);
    localStorage.removeItem("selectedCompanyId");
    localStorage.removeItem("selectedYearId");
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
