import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  requireCompany?: boolean;
  requireAdmin?: boolean; // super_admin OR local_admin
}

export function ProtectedRoute({ 
  children, 
  requireCompany = true,
  requireAdmin = false 
}: ProtectedRouteProps) {
  const { user, loading, selectedCompany, selectedYear, isSuperAdmin, isLocalAdmin, userRole, localAdminCompanyIds, initialLoadDone } = useAuth();

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

  // Wait for role data to load before checking admin access
  if (requireAdmin && userRole === null && localAdminCompanyIds.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Učitavanje...</div>
      </div>
    );
  }

  if (requireAdmin && !isSuperAdmin && !isLocalAdmin) {
    return <Navigate to="/" replace />;
  }

  // Don't redirect to select-company until initial data load is complete
  if (requireCompany && !initialLoadDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Učitavanje...</div>
      </div>
    );
  }

  if (requireCompany && (!selectedCompany || !selectedYear)) {
    return <Navigate to="/select-company" replace />;
  }

  return <>{children}</>;
}
