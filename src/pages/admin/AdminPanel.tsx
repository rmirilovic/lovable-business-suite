import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Shield, Calendar, Database, KeyRound, UserCheck, ClipboardList, Wifi } from "lucide-react";
import { CompaniesTab } from "@/components/admin/CompaniesTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { AccessTab } from "@/components/admin/AccessTab";
import { BusinessYearsTab } from "@/components/admin/BusinessYearsTab";
import { DataImportTab } from "@/components/admin/DataImportTab";
import { RolesTab } from "@/components/admin/RolesTab";
import { UserRolesTab } from "@/components/admin/UserRolesTab";
import { LoginAuditTab } from "@/components/admin/LoginAuditTab";
import { ActiveSessionsTab } from "@/components/admin/ActiveSessionsTab";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("companies");
  const tabs = [
    { value: "companies", label: "Firme", icon: Building2 },
    { value: "years", label: "Godine", icon: Calendar },
    { value: "users", label: "Korisnici", icon: Users },
    { value: "access", label: "Pristupi", icon: Shield },
    { value: "roles", label: "Uloge", icon: KeyRound },
    { value: "user-roles", label: "Dodela uloga", icon: UserCheck },
    { value: "data", label: "Podaci", icon: Database },
    { value: "login-audit", label: "Prijave", icon: ClipboardList },
    { value: "active-sessions", label: "Sesije", icon: Wifi },
  ];

  return (
    <MainLayout title="Administracija">
      <div className="flex-1 min-h-0 overflow-auto space-y-6">
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

          <TabsContent value="active-sessions" className="mt-6">
            <ActiveSessionsTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
