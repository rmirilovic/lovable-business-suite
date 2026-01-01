import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar currentCompany="ABC Kompanija d.o.o." currentYear="2025" />
      <div className="ml-64">
        <Header title={title} userName="Marko Petrović" />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
