import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Building2, Calendar, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { appNavigation, type NavigationChild, type NavigationItem } from "@/config/appNavigation";
import { useWacReconciliationPendingCount } from "@/hooks/useWacReconciliation";

const navigation: NavigationItem[] = appNavigation;

const PNC_HREF = "/racunovodstvo/uskladjivanje-pnc";

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
}

export function Sidebar({ mobileOpen, onMobileClose, collapsed = false }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, signOut, isSuperAdmin, isLocalAdmin, loading: authLoading, initialLoadDone } = useAuth();
  const { hasAccess, isLoading: permissionsLoading } = usePermissions();
  const canSeePncBadge = isSuperAdmin || isLocalAdmin;
  const { data: pncPendingCount = 0 } = useWacReconciliationPendingCount();
  const showPncBadge = canSeePncBadge && pncPendingCount > 0;

  // Treat as full access while any part of the auth/permissions pipeline is still settling
  const stillLoading = authLoading || !initialLoadDone || permissionsLoading;

  // Find which parent menu contains the active route
  const getActiveParent = () => {
    for (const item of navigation) {
      if (item.children?.some((child) => location.pathname === child.href)) {
        return item.label;
      }
    }
    return null;
  };

  const activeParent = getActiveParent();
  const [expandedItems, setExpandedItems] = useState<string[]>(activeParent ? [activeParent] : []);

  // Update expanded items when route changes
  useEffect(() => {
    const parent = getActiveParent();
    if (parent) {
      setExpandedItems([parent]);
    }
  }, [location.pathname]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [location.pathname]);

  const hasModuleAccess = (moduleCode?: string) => {
    if (!moduleCode) return true;
    if (isSuperAdmin || isLocalAdmin || stillLoading) return true;
    return hasAccess(moduleCode);
  };

  const getFilteredChildren = (children: NavigationChild[], parentModuleCode?: string) => {
    if (isSuperAdmin || isLocalAdmin || stillLoading) {
      return children;
    }

    if (parentModuleCode && hasAccess(parentModuleCode)) {
      return children;
    }

    return children.filter((child) => {
      if (!child.moduleCode) return true;
      return hasAccess(child.moduleCode);
    });
  };

  // Filter navigation based on permissions
  const getFilteredNavigation = () => {
    if (isSuperAdmin || isLocalAdmin) {
      return navigation.filter((item) => item.href !== "/admin" || isSuperAdmin || isLocalAdmin);
    }

    if (stillLoading) {
      // Show full navigation while auth/permissions are stabilizing
      // to avoid flicker for admin-only sections during token rotation.
      return navigation;
    }

    return navigation.filter((item) => {
      if (item.href === "/") return true;
      if (item.href === "/admin") {
        return isSuperAdmin || isLocalAdmin;
      }
      if (item.children) {
        const accessibleChildren = getFilteredChildren(item.children, item.moduleCode);
        return accessibleChildren.length > 0 || hasModuleAccess(item.moduleCode);
      }
      return hasModuleAccess(item.moduleCode);
    });
  };

  const filteredNavigation = getFilteredNavigation();

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [label]
    );
  };

  const isActive = (href: string) => location.pathname === href;
  const isParentActive = (children?: NavigationChild[]) =>
    children?.some((child) => location.pathname === child.href);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleChangeCompany = () => {
    navigate("/select-company");
  };

  const sidebarContent = (
    <>
      {/* Logo & Company */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-lg font-semibold text-sidebar-foreground">
                  Mini ERP
                </h1>
                <p className="text-xs text-sidebar-foreground/60">
                  Poslovno rešenje
                </p>
              </div>
            )}
          </div>
          {/* Close button - mobile only */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="lg:hidden p-1 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Company & Year Selector */}
        {!collapsed ? (
          <div className="space-y-2">
            <button 
              onClick={handleChangeCompany}
              className="w-full flex items-center justify-between px-3 py-2 bg-sidebar-accent rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/80 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="truncate">{selectedCompany?.name || "Izaberite firmu"}</span>
              </span>
              <ChevronDown className="w-4 h-4 opacity-60" />
            </button>
            <button 
              onClick={handleChangeCompany}
              className="w-full flex items-center justify-between px-3 py-2 bg-sidebar-accent rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/80 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Godina {selectedYear?.year || "-"}</span>
              </span>
              <ChevronDown className="w-4 h-4 opacity-60" />
            </button>
          </div>
        ) : (
          <div className="space-y-2 flex flex-col items-center">
            <button
              onClick={handleChangeCompany}
              className="p-2 rounded-md bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors"
              title={selectedCompany?.name || "Izaberite firmu"}
            >
              <Building2 className="w-4 h-4 text-sidebar-foreground" />
            </button>
            <button
              onClick={handleChangeCompany}
              className="p-2 rounded-md bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors"
              title={`Godina ${selectedYear?.year || "-"}`}
            >
              <Calendar className="w-4 h-4 text-sidebar-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredNavigation.map((item) => (
          <div key={item.label}>
            {item.href ? (
              collapsed ? (
                <button
                  onClick={() => navigate(item.href!)}
                  className={cn(
                    "w-full flex items-center justify-center p-2 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                    isActive(item.href) && "erp-sidebar-link-active"
                  )}
                  title={item.label}
                >
                  <item.icon className="w-5 h-5" />
                </button>
              ) : (
                <a
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(item.href!);
                  }}
                  className={cn(
                    "erp-sidebar-link",
                    isActive(item.href) && "erp-sidebar-link-active"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </a>
              )
            ) : collapsed ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "relative w-full flex items-center justify-center p-2 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                      isParentActive(item.children) && "text-sidebar-foreground bg-sidebar-accent"
                    )}
                    title={
                      showPncBadge && item.children?.some((c) => c.href === PNC_HREF)
                        ? `${item.label} (${pncPendingCount} novo usklađivanje PNC)`
                        : item.label
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {showPncBadge && item.children?.some((c) => c.href === PNC_HREF) && (
                      <span
                        aria-label={`${pncPendingCount} novih usklađivanja PNC`}
                        className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-warning text-warning-foreground text-[10px] font-bold flex items-center justify-center"
                      >
                        {pncPendingCount > 9 ? "9+" : pncPendingCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="min-w-48">
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">{item.label}</DropdownMenuLabel>
                  {item.children && getFilteredChildren(item.children, item.moduleCode).map((child) => (
                    <DropdownMenuItem
                      key={child.href}
                      onClick={() => navigate(child.href)}
                      className={cn(
                        "flex items-center justify-between gap-2",
                        isActive(child.href) && "bg-accent font-medium"
                      )}
                    >
                      <span>{child.label}</span>
                      {showPncBadge && child.href === PNC_HREF && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold flex items-center justify-center">
                          {pncPendingCount > 99 ? "99+" : pncPendingCount}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <button
                  onClick={() => toggleExpand(item.label)}
                  className={cn(
                    "erp-sidebar-link w-full justify-between",
                    isParentActive(item.children) && "text-sidebar-foreground"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                    {showPncBadge && item.children?.some((c) => c.href === PNC_HREF) && (
                      <span
                        aria-label={`${pncPendingCount} novih usklađivanja PNC`}
                        title={`${pncPendingCount} novih usklađivanja PNC`}
                        className="min-w-[20px] h-5 px-1.5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold flex items-center justify-center"
                      >
                        {pncPendingCount > 99 ? "99+" : pncPendingCount}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 transition-transform duration-200",
                      expandedItems.includes(item.label) && "rotate-180"
                    )}
                  />
                </button>
                {expandedItems.includes(item.label) && item.children && (
                  <div className="ml-8 mt-1 space-y-1">
                    {getFilteredChildren(item.children, item.moduleCode).map((child) => (
                      <a
                        key={child.href}
                        href={child.href}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(child.href);
                        }}
                        className={cn(
                          "flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors",
                          isActive(child.href) &&
                            "text-sidebar-foreground bg-sidebar-accent/50 font-medium"
                        )}
                      >
                        <span>{child.label}</span>
                        {showPncBadge && child.href === PNC_HREF && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold flex items-center justify-center">
                            {pncPendingCount > 99 ? "99+" : pncPendingCount}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-sidebar-border">
        {collapsed ? (
          <div className="space-y-2">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center p-2 rounded-md text-sidebar-foreground/70 hover:text-destructive transition-colors"
              title="Odjavi se"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <button 
              onClick={handleSignOut}
              className="erp-sidebar-link w-full text-sidebar-foreground/70 hover:text-destructive"
            >
              <LogOut className="w-5 h-5" />
              <span>Odjavi se</span>
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border flex-col transition-[width] duration-200",
        collapsed ? "w-16" : "w-64"
      )}>
        {sidebarContent}
      </aside>

      {/* Mobile sidebar - overlay */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/50"
            onClick={onMobileClose}
          />
          <aside className="lg:hidden fixed left-0 top-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col animate-slide-in-left">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
