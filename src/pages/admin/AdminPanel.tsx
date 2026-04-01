import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Shield, Calendar, Database, KeyRound, UserCheck, RefreshCw, ClipboardList } from "lucide-react";
import { CompaniesTab } from "@/components/admin/CompaniesTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { AccessTab } from "@/components/admin/AccessTab";
import { BusinessYearsTab } from "@/components/admin/BusinessYearsTab";
import { DataImportTab } from "@/components/admin/DataImportTab";
import { RolesTab } from "@/components/admin/RolesTab";
import { UserRolesTab } from "@/components/admin/UserRolesTab";
import { LoginAuditTab } from "@/components/admin/LoginAuditTab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("companies");
  const [isRefreshingMenus, setIsRefreshingMenus] = useState(false);
  const { isSuperAdmin, refreshAuthState } = useAuth();

  const handleRefreshMenus = async () => {
    try {
      setIsRefreshingMenus(true);
      await refreshAuthState();
      toast.success("Ponovno učitavanje menija je pokrenuto.");
    } catch (error) {
      console.error("Menu refresh failed:", error);
      toast.error("Greška pri ponovnom učitavanju menija.");
    } finally {
      setIsRefreshingMenus(false);
    }
  };

  const tabs = [
    { value: "companies", label: "Firme", icon: Building2 },
    { value: "years", label: "Godine", icon: Calendar },
    { value: "users", label: "Korisnici", icon: Users },
    { value: "access", label: "Pristupi", icon: Shield },
    { value: "roles", label: "Uloge", icon: KeyRound },
    { value: "user-roles", label: "Dodela uloga", icon: UserCheck },
    { value: "data", label: "Podaci", icon: Database },
    { value: "login-audit", label: "Prijave", icon: ClipboardList },
  ];

  return (
    <MainLayout title="Administracija">
      <div className="space-y-6">
        <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">Osveži navigaciju</CardTitle>
                <CardDescription>
                  Ručno ponovo učitaj auth i dozvole ako sporni meniji ne postanu vidljivi sami.
                </CardDescription>
              </div>
              <Button
                type="button"
                onClick={handleRefreshMenus}
                disabled={isRefreshingMenus}
                className="sm:self-start"
              >
                <RefreshCw className={isRefreshingMenus ? "animate-spin" : ""} />
                Ponovo učitaj menije
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">
                Ovo ne radi browser refresh, već interno ponovo inicijalizuje korisnički pristup.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 w-full">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="companies" className="mt-6">
            <CompaniesTab />
          </TabsContent>

          <TabsContent value="years" className="mt-6">
            <BusinessYearsTab />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <UsersTab />
          </TabsContent>

          <TabsContent value="access" className="mt-6">
            <AccessTab />
          </TabsContent>

          <TabsContent value="roles" className="mt-6">
            <RolesTab />
          </TabsContent>

          <TabsContent value="user-roles" className="mt-6">
            <UserRolesTab />
          </TabsContent>

          <TabsContent value="data" className="mt-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
            <DataImportTab />
          </TabsContent>

          <TabsContent value="login-audit" className="mt-6">
            <LoginAuditTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
