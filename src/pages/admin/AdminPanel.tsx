import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Shield, Calendar } from "lucide-react";
import { CompaniesTab } from "@/components/admin/CompaniesTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { AccessTab } from "@/components/admin/AccessTab";
import { BusinessYearsTab } from "@/components/admin/BusinessYearsTab";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminPanel() {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? "companies" : "years");

  // Local admins can only see Years and Access tabs for their companies
  const tabs = isSuperAdmin
    ? [
        { value: "companies", label: "Firme", icon: Building2 },
        { value: "years", label: "Godine", icon: Calendar },
        { value: "users", label: "Korisnici", icon: Users },
        { value: "access", label: "Pristupi", icon: Shield },
      ]
    : [
        { value: "years", label: "Godine", icon: Calendar },
        { value: "access", label: "Pristupi", icon: Shield },
      ];

  return (
    <MainLayout title="Administracija">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full lg:w-[${tabs.length * 130}px]`} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {isSuperAdmin && (
            <TabsContent value="companies" className="mt-6">
              <CompaniesTab />
            </TabsContent>
          )}

          <TabsContent value="years" className="mt-6">
            <BusinessYearsTab />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="users" className="mt-6">
              <UsersTab />
            </TabsContent>
          )}

          <TabsContent value="access" className="mt-6">
            <AccessTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
