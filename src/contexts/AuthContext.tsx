import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [businessYears, setBusinessYears] = useState<BusinessYear[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedYear, setSelectedYear] = useState<BusinessYear | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          setTimeout(() => {
            fetchUserCompanies(session.user.id);
          }, 0);
        } else {
          setCompanies([]);
          setBusinessYears([]);
          setSelectedCompany(null);
          setSelectedYear(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        fetchUserCompanies(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
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
