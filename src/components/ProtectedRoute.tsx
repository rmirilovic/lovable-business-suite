import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  requireCompany?: boolean;
}

export function ProtectedRoute({ children, requireCompany = true }: ProtectedRouteProps) {
  const { user, loading, selectedCompany, selectedYear } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Učitavanje...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requireCompany && (!selectedCompany || !selectedYear)) {
    return <Navigate to="/select-company" replace />;
  }

  return <>{children}</>;
}
