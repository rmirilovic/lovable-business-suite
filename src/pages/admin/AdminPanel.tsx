import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Shield, Calendar, Database, KeyRound, UserCheck } from "lucide-react";
import { CompaniesTab } from "@/components/admin/CompaniesTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { AccessTab } from "@/components/admin/AccessTab";
import { BusinessYearsTab } from "@/components/admin/BusinessYearsTab";
import { DataImportTab } from "@/components/admin/DataImportTab";
import { RolesTab } from "@/components/admin/RolesTab";
import { UserRolesTab } from "@/components/admin/UserRolesTab";

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
  ];

  return (
    <MainLayout title="Administracija">
      <div className="space-y-6">
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

          <TabsContent value="data" className="mt-6">
            <DataImportTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
