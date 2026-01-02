import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Shield, Calendar } from "lucide-react";
import { CompaniesTab } from "@/components/admin/CompaniesTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { AccessTab } from "@/components/admin/AccessTab";
import { BusinessYearsTab } from "@/components/admin/BusinessYearsTab";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("companies");

  return (
    <MainLayout title="Administracija">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-[520px]">
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Firme</span>
            </TabsTrigger>
            <TabsTrigger value="years" className="gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Godine</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Korisnici</span>
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Pristupi</span>
            </TabsTrigger>
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
        </Tabs>
      </div>
    </MainLayout>
  );
}
