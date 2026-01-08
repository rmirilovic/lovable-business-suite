import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, Calendar, LogOut, Mail, User } from "lucide-react";

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

export default function SelectCompany() {
  const { 
    user, 
    companies, 
    businessYears, 
    selectedCompany, 
    selectedYear,
    setSelectedCompany,
    setSelectedYear,
    signOut,
    loading
  } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, phone")
        .eq("id", user.id)
        .maybeSingle();
      
      if (!error && data) {
        setProfile(data);
      }
    };
    
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleContinue = () => {
    if (selectedCompany && selectedYear) {
      navigate("/");
    }
  };

  const handleCompanyChange = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (company) {
      setSelectedCompany(company);
      setSelectedYear(null);
    }
  };

  const handleYearChange = (yearId: string) => {
    const year = businessYears.find(y => y.id === yearId);
    if (year) {
      setSelectedYear(year);
    }
  };

  const getUserDisplayName = () => {
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    }
    return user?.email?.split("@")[0] || "Korisnik";
  };

  const getUserInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.first_name) {
      return profile.first_name.substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || "KO";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/5 flex items-center justify-center">
        <div className="text-muted-foreground">Učitavanje...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-primary p-3 rounded-xl">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="ml-3">
            <h1 className="text-2xl font-bold text-foreground">Mini ERP</h1>
            <p className="text-sm text-muted-foreground">Poslovno rešenje</p>
          </div>
        </div>

        {/* User Info Card */}
        <Card className="shadow-lg border-border/50 mb-4">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground truncate">
                  {getUserDisplayName()}
                </h2>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{user?.email}</span>
                </div>
                {profile?.phone && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                    <User className="h-3 w-3 flex-shrink-0" />
                    <span>{profile.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">Izbor firme i godine</CardTitle>
            <CardDescription className="text-center">
              Izaberite firmu i poslovnu godinu za rad
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {companies.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">Nemate pristup nijednoj firmi</p>
                <p className="text-sm text-muted-foreground">
                  Kontaktirajte administratora za dodelu pristupa.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Firma
                  </label>
                  <Select
                    value={selectedCompany?.id || ""}
                    onValueChange={handleCompanyChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Izaberite firmu" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name} ({company.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Poslovna godina
                  </label>
                  <Select
                    value={selectedYear?.id || ""}
                    onValueChange={handleYearChange}
                    disabled={!selectedCompany || businessYears.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        !selectedCompany 
                          ? "Prvo izaberite firmu" 
                          : businessYears.length === 0 
                            ? "Nema poslovnih godina"
                            : "Izaberite godinu"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {businessYears.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleContinue} 
                  className="w-full"
                  disabled={!selectedCompany || !selectedYear}
                >
                  Nastavi
                </Button>
              </>
            )}

            <Button 
              variant="outline" 
              onClick={signOut} 
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Odjavi se
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
