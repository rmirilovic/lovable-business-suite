import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/contexts/AuthContext";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const userName = user?.user_metadata?.first_name && user?.user_metadata?.last_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
    : user?.email || "Korisnik";

  return (
    <div className="min-h-screen lg:h-screen bg-background flex overflow-x-hidden lg:overflow-hidden">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="lg:ml-64 flex-1 flex flex-col min-h-0 w-full min-w-0">
        <Header title={title} userName={userName} onMobileMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 min-h-0 p-4 lg:p-6 flex flex-col lg:overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
