import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentDocuments } from "@/components/dashboard/RecentDocuments";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { LowStockAlert } from "@/components/dashboard/LowStockAlert";
import {
  TrendingUp,
  FileText,
  Package,
  Users,
} from "lucide-react";

const Index = () => {
  return (
    <MainLayout title="Kontrolna tabla">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Ukupna prodaja (mesec)"
          value="4.2M RSD"
          change={12.5}
          changeLabel="vs prošli mesec"
          icon={TrendingUp}
          iconColor="success"
        />
        <StatCard
          title="Otvorene fakture"
          value="23"
          change={-8.2}
          changeLabel="vs prošli mesec"
          icon={FileText}
          iconColor="accent"
        />
        <StatCard
          title="Artikli na stanju"
          value="1,234"
          icon={Package}
          iconColor="primary"
        />
        <StatCard
          title="Aktivni partneri"
          value="156"
          change={5.3}
          changeLabel="novih ovog meseca"
          icon={Users}
          iconColor="warning"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        <QuickActions />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentDocuments />
        <LowStockAlert />
      </div>
    </MainLayout>
  );
};

export default Index;
