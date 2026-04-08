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

  // Only show loading screen on initial load; once loaded, keep children
  // mounted to preserve dialog/form state during transient auth refreshes
  if (loading && !initialLoadDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Učitavanje...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Wait for full auth bootstrap before checking admin access
  if (requireAdmin && !initialLoadDone) {
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
