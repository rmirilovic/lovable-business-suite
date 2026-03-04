import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  X,
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
      { label: "Šefovi smena", href: "/sifarnici/sefovi-smena", moduleCode: "sifarnici.ulazni_troskovi" },
      { label: "Tekući računi", href: "/sifarnici/tekuci-racuni", moduleCode: "sifarnici.magacini" },
      { label: "Šifarnik plaćanja", href: "/sifarnici/sifarnik-placanja", moduleCode: "racunovodstvo.nalozi" },
    ],
  },
  {
    label: "Prodaja",
    icon: ShoppingCart,
    moduleCode: "prodaja",
    children: [
      { label: "Ponude", href: "/prodaja/ponude", moduleCode: "prodaja.ponude" },
      { label: "Nalozi za isporuku", href: "/prodaja/nalozi-isporuka", moduleCode: "prodaja.otpremnice" },
      { label: "Fakture", href: "/prodaja/fakture", moduleCode: "prodaja.fakture" },
      { label: "Fakture za avans", href: "/prodaja/avansni-racuni", moduleCode: "prodaja.fakture" },
      { label: "Knjižna odobrenja", href: "/prodaja/knjizna-odobrenja", moduleCode: "prodaja.fakture" },
    ],
  },
  {
    label: "Nabavka",
    icon: FileText,
    moduleCode: "nabavka",
    children: [
      { label: "UF za usluge", href: "/nabavka/ulazne-fakture-usluge", moduleCode: "nabavka.ulazne_fakture" },
      { label: "UF za robu", href: "/nabavka/ulazne-fakture-roba", moduleCode: "nabavka.ulazne_fakture" },
      { label: "Kalkulacije", href: "/magacin/kalkulacije", moduleCode: "robno.prijemnice" },
      { label: "Narudžbenice", href: "/nabavka/narudzbenice", moduleCode: "nabavka.porudzbine" },
    ],
  },
  {
    label: "Magacin",
    icon: Warehouse,
    moduleCode: "robno",
    children: [
      { label: "Prijemnice", href: "/magacin/prijemnice", moduleCode: "robno.prijemnice" },
      { label: "Otpremnice", href: "/prodaja/otpremnice", moduleCode: "prodaja.otpremnice" },
      { label: "Nivelacije", href: "/magacin/nivelacije", moduleCode: "robno.prijemnice" },
      { label: "Međumagacinski prenosi", href: "/magacin/prenosi", moduleCode: "robno.prijemnice" },
      { label: "Zamena artikla", href: "/magacin/zamene", moduleCode: "robno.prijemnice" },
      { label: "Popisi", href: "/magacin/popisi", moduleCode: "robno.prijemnice" },
      { label: "Stanje magacina", href: "/magacin/stanje", moduleCode: "robno.prijemnice" },
      { label: "Stanje sa rezervacijama", href: "/magacin/stanje-rezervacije", moduleCode: "robno.prijemnice" },
      { label: "Rezervacije", href: "/magacin/rezervacije", moduleCode: "robno.prijemnice" },
      { label: "Promet magacina", href: "/magacin/promet", moduleCode: "robno.prijemnice" },
      { label: "Lager lista", href: "/magacin/lager-lista", moduleCode: "robno.prijemnice" },
    ],
  },
  {
    label: "Proizvodnja",
    icon: Factory,
    moduleCode: "proizvodnja",
    children: [
      { label: "Normativi", href: "/proizvodnja/normativi", moduleCode: "proizvodnja.sastavnice" },
      { label: "Radni nalozi", href: "/proizvodnja/nalozi", moduleCode: "proizvodnja.radni_nalozi" },
      { label: "Trebovanja", href: "/proizvodnja/trebovanja", moduleCode: "proizvodnja.trebovanja" },
      { label: "Predajnice GP", href: "/proizvodnja/predajnice", moduleCode: "proizvodnja.radni_nalozi" },
      { label: "RN za preradu", href: "/proizvodnja/prerada", moduleCode: "proizvodnja.radni_nalozi" },
      { label: "Predajnice preradu", href: "/proizvodnja/predajnice-prerada", moduleCode: "proizvodnja.radni_nalozi" },
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
      { label: "Izvodi", href: "/racunovodstvo/izvodi", moduleCode: "racunovodstvo.nalozi" },
      
      { label: "Glavna knjiga", href: "/racunovodstvo/glavna-knjiga", moduleCode: "racunovodstvo.glavna_knjiga" },
      { label: "Bruto bilans", href: "/racunovodstvo/bruto-bilans", moduleCode: "racunovodstvo.bruto_bilans" },
      { label: "Kartice partnera", href: "/racunovodstvo/kartice-partnera", moduleCode: "racunovodstvo.kartice_partnera" },
      { label: "POPDV", href: "/racunovodstvo/popdv", moduleCode: "racunovodstvo.nalozi" },
      { label: "PP-PDV Prijava", href: "/racunovodstvo/pp-pdv", moduleCode: "racunovodstvo.nalozi" },
    ],
  },
  { label: "Administracija", icon: Settings, href: "/admin", moduleCode: "administracija" },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
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

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [location.pathname]);

  // Filter navigation based on permissions
  const getFilteredNavigation = () => {
    if (permissionsLoading) {
      return navigation.filter(item => !item.moduleCode || item.href === "/");
    }

    return navigation.filter((item) => {
      if (item.href === "/") return true;
      if (item.href === "/admin") {
        return isSuperAdmin || isLocalAdmin;
      }
      if (item.children) {
        const accessibleChildren = item.children.filter(child => {
          if (!child.moduleCode) return true;
          return hasAccess(child.moduleCode);
        });
        return accessibleChildren.length > 0;
      }
      if (item.moduleCode) {
        return hasAccess(item.moduleCode);
      }
      return true;
    });
  };

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
        : [label]
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

  const sidebarContent = (
    <>
      {/* Logo & Company */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
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
                      <a
                        key={child.href}
                        href={child.href}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(child.href);
                        }}
                        className={cn(
                          "block px-3 py-2 text-sm rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors",
                          isActive(child.href) &&
                            "text-sidebar-foreground bg-sidebar-accent/50 font-medium"
                        )}
                      >
                        {child.label}
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
        <button 
          onClick={handleSignOut}
          className="erp-sidebar-link w-full text-sidebar-foreground/70 hover:text-destructive"
        >
          <LogOut className="w-5 h-5" />
          <span>Odjavi se</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar - always visible */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar - overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/50"
            onClick={onMobileClose}
          />
          {/* Sidebar panel */}
          <aside className="lg:hidden fixed left-0 top-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col animate-slide-in-left">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
