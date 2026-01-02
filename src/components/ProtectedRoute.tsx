import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  requireCompany?: boolean;
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requireCompany = true,
  requireSuperAdmin = false 
}: ProtectedRouteProps) {
  const { user, loading, selectedCompany, selectedYear, isSuperAdmin, userRole } = useAuth();

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

  // Wait for role to load before checking admin access
  if (requireSuperAdmin && userRole === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Učitavanje...</div>
      </div>
    );
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireCompany && (!selectedCompany || !selectedYear)) {
    return <Navigate to="/select-company" replace />;
  }

  return <>{children}</>;
}
