import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  ShoppingCart,
  Factory,
  Warehouse,
  Settings,
  ChevronDown,
  Building2,
  Calendar,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

interface NavChild {
  label: string;
  href: string;
  moduleCode?: string;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  moduleCode?: string;
  children?: NavChild[];
}

const navigation: NavItem[] = [
  { label: "Kontrolna tabla", icon: LayoutDashboard, href: "/" },
  {
    label: "Šifarnici",
    icon: Package,
    moduleCode: "sifarnici",
    children: [
      { label: "Artikli", href: "/sifarnici/artikli", moduleCode: "sifarnici.artikli" },
      { label: "Klasifikacija artikala", href: "/sifarnici/grupe", moduleCode: "sifarnici.klasifikacije" },
      { label: "Atributi artikala", href: "/sifarnici/atributi", moduleCode: "sifarnici.atributi" },
      { label: "Magacini", href: "/sifarnici/magacini", moduleCode: "sifarnici.magacini" },
      { label: "Partneri", href: "/sifarnici/partneri", moduleCode: "sifarnici.partneri" },
      { label: "Organizacione jedinice", href: "/sifarnici/org-jedinice", moduleCode: "sifarnici.org_jedinice" },
      { label: "Kontni plan", href: "/sifarnici/kontni-plan", moduleCode: "racunovodstvo.kontni_plan" },
      { label: "Ulazni troškovi", href: "/sifarnici/ulazni-troskovi", moduleCode: "sifarnici.ulazni_troskovi" },
    ],
  },
  {
    label: "Prodaja",
    icon: ShoppingCart,
    moduleCode: "prodaja",
    children: [
      { label: "Ponude", href: "/prodaja/ponude", moduleCode: "prodaja.ponude" },
      { label: "Fakture", href: "/prodaja/fakture", moduleCode: "prodaja.fakture" },
      { label: "Otpremnice", href: "/prodaja/otpremnice", moduleCode: "prodaja.otpremnice" },
    ],
  },
  {
    label: "Nabavka",
    icon: FileText,
    moduleCode: "nabavka",
    children: [
      { label: "UF za usluge", href: "/nabavka/ulazne-fakture-usluge", moduleCode: "nabavka.ulazne_fakture" },
      { label: "UF za robu", href: "/nabavka/ulazne-fakture-roba", moduleCode: "nabavka.ulazne_fakture" },
      { label: "Narudžbenice", href: "/nabavka/narudzbenice", moduleCode: "nabavka.porudzbine" },
    ],
  },
  {
    label: "Magacin",
    icon: Warehouse,
    moduleCode: "robno",
    children: [
      { label: "Prijemnice", href: "/magacin/prijemnice", moduleCode: "robno.prijemnice" },
      { label: "Stanje magacina", href: "/magacin/stanje", moduleCode: "robno.prijemnice" },
    ],
  },
  {
    label: "Proizvodnja",
    icon: Factory,
    moduleCode: "proizvodnja",
    children: [
      { label: "Radni nalozi", href: "/proizvodnja/nalozi", moduleCode: "proizvodnja.radni_nalozi" },
      { label: "Sastavnice", href: "/proizvodnja/sastavnice", moduleCode: "proizvodnja.sastavnice" },
      { label: "Recepture", href: "/proizvodnja/recepture", moduleCode: "proizvodnja.sastavnice" },
    ],
  },
  { label: "Partneri", icon: Users, href: "/partneri", moduleCode: "sifarnici.partneri" },
  {
    label: "Računovodstvo",
    icon: FileText,
    moduleCode: "racunovodstvo",
    children: [
      { label: "Nalozi za knjiženje", href: "/racunovodstvo/nalozi", moduleCode: "racunovodstvo.nalozi" },
      { label: "Glavna knjiga", href: "/racunovodstvo/glavna-knjiga", moduleCode: "racunovodstvo.glavna_knjiga" },
      { label: "Bruto bilans", href: "/racunovodstvo/bruto-bilans", moduleCode: "racunovodstvo.bruto_bilans" },
      { label: "Kartice partnera", href: "/racunovodstvo/kartice-partnera", moduleCode: "racunovodstvo.kartice_partnera" },
    ],
  },
  { label: "Administracija", icon: Settings, href: "/admin", moduleCode: "administracija" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, signOut, isSuperAdmin, isLocalAdmin } = useAuth();
  const { hasAccess, isLoading: permissionsLoading } = usePermissions();

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

  // Filter navigation based on permissions
  const getFilteredNavigation = () => {
    // While loading permissions, show basic navigation
    if (permissionsLoading) {
      return navigation.filter(item => !item.moduleCode || item.href === "/");
    }

    return navigation.filter((item) => {
      // Dashboard is always visible
      if (item.href === "/") return true;

      // Admin panel - only for super admin or local admin
      if (item.href === "/admin") {
        return isSuperAdmin || isLocalAdmin;
      }

      // Check if user has access to any child module
      if (item.children) {
        const accessibleChildren = item.children.filter(child => {
          if (!child.moduleCode) return true;
          return hasAccess(child.moduleCode);
        });
        return accessibleChildren.length > 0;
      }

      // Single item - check module access
      if (item.moduleCode) {
        return hasAccess(item.moduleCode);
      }

      return true;
    });
  };

  // Filter children based on permissions
  const getFilteredChildren = (children: NavChild[]) => {
    return children.filter(child => {
      if (!child.moduleCode) return true;
      return hasAccess(child.moduleCode);
    });
  };

  const filteredNavigation = getFilteredNavigation();

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [label] // Only keep this one open (accordion behavior)
    );
  };

  const isActive = (href: string) => location.pathname === href;
  const isParentActive = (children?: NavChild[]) =>
    children?.some((child) => location.pathname === child.href);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleChangeCompany = () => {
    navigate("/select-company");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo & Company */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">
              Mini ERP
            </h1>
            <p className="text-xs text-sidebar-foreground/60">
              Poslovno rešenje
            </p>
          </div>
        </div>

        {/* Company & Year Selector */}
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredNavigation.map((item) => (
          <div key={item.label}>
            {item.href ? (
              <Link
                to={item.href}
                className={cn(
                  "erp-sidebar-link",
                  isActive(item.href) && "erp-sidebar-link-active"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
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
                    {getFilteredChildren(item.children).map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        className={cn(
                          "block px-3 py-2 text-sm rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors",
                          isActive(child.href) &&
                            "text-sidebar-foreground bg-sidebar-accent/50 font-medium"
                        )}
                      >
                        {child.label}
                      </Link>
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
        <button 
          onClick={handleSignOut}
          className="erp-sidebar-link w-full text-sidebar-foreground/70 hover:text-destructive"
        >
          <LogOut className="w-5 h-5" />
          <span>Odjavi se</span>
        </button>
      </div>
    </aside>
  );
}
