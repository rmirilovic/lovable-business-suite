import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/contexts/AuthContext";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  const { user } = useAuth();
  
  const userName = user?.user_metadata?.first_name && user?.user_metadata?.last_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
    : user?.email || "Korisnik";

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <Sidebar />
      <div className="ml-64 flex-1 flex flex-col min-h-0">
        <Header title={title} userName={userName} />
        <main className="flex-1 min-h-0 p-6 flex flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
