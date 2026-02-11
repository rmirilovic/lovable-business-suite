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

    // --- Session handoff between iframe and new tab ---
    // Some browsers partition storage between preview iframe and a new tab.
    // We pass the session via postMessage so the report tab doesn't require re-login.
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const msg = event.data as any;

      // Opener tab responds with current session
      if (msg?.type === "REQUEST_SESSION") {
        // Get fresh session to avoid stale/already-used refresh tokens
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

      // New tab receives session and sets it
      if (msg?.type === "SESSION_RESPONSE" && msg?.payload?.access_token && msg?.payload?.refresh_token) {
        awaitingHandoff = false;

        if (handoffTimeout) {
          window.clearTimeout(handoffTimeout);
          handoffTimeout = null;
        }

        // Keep loading until auth state updates with a user
        setLoading(true);

        void supabase.auth.setSession({
          access_token: msg.payload.access_token,
          refresh_token: msg.payload.refresh_token,
        });
        return;
      }
    };

    window.addEventListener("message", messageHandler);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      sessionRef.current = nextSession;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      // IMPORTANT: prevent redirect-to-login while waiting for session handoff
      if (awaitingHandoff && !nextSession?.user) {
        setLoading(true);
        return;
      }

      // End loading only after initial session check is done
      if (initialSessionChecked) {
        setLoading(false);
      }

      if (event === "SIGNED_IN") {
        if (nextSession?.user) {
          setTimeout(() => {
            fetchUserCompanies(nextSession.user.id);
            fetchUserRole(nextSession.user.id);
            fetchLocalAdminCompanies(nextSession.user.id);
            setInitialLoadDone(true);
          }, 0);
        }
        return;
      }

      if (event === "SIGNED_OUT") {
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

      // Ignore TOKEN_REFRESHED/USER_UPDATED/etc.
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;

      initialSessionChecked = true;
      sessionRef.current = initialSession;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (!initialSession?.user && window.opener) {
        // Ask opener (iframe tab) for session and wait a bit before concluding user is logged out
        awaitingHandoff = true;
        setLoading(true);
        try {
          window.opener.postMessage({ type: "REQUEST_SESSION" }, origin);
        } catch {
          // ignore
        }
        handoffTimeout = window.setTimeout(() => {
          awaitingHandoff = false;
          if (!isMounted) return;
          setLoading(false);
        }, 4000);
      } else {
        setLoading(false);
      }

      if (initialSession?.user && !initialLoadDone) {
        fetchUserCompanies(initialSession.user.id);
        fetchUserRole(initialSession.user.id);
        fetchLocalAdminCompanies(initialSession.user.id);
        setInitialLoadDone(true);
      }
    });

    return () => {
      isMounted = false;
      if (handoffTimeout) window.clearTimeout(handoffTimeout);
      window.removeEventListener("message", messageHandler);
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserCompanies = async (userId: string) => {
    const { data: companiesData, error } = await supabase
      .from("companies")
      .select("id, name, code");

    if (!error && companiesData) {
      setCompanies(companiesData);
      
      const savedCompanyId = localStorage.getItem("selectedCompanyId");
      const savedCompany = companiesData.find(c => c.id === savedCompanyId);
      
      if (savedCompany) {
        setSelectedCompany(savedCompany);
        fetchBusinessYears(savedCompany.id);
      } else if (companiesData.length > 0) {
        setSelectedCompany(companiesData[0]);
        fetchBusinessYears(companiesData[0].id);
      }
    }
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
