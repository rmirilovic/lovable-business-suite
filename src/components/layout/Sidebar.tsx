import { useState } from "react";
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

interface NavItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { label: string; href: string }[];
}

const navigation: NavItem[] = [
  { label: "Kontrolna tabla", icon: LayoutDashboard, href: "/" },
  {
    label: "Šifarnici",
    icon: Package,
    children: [
      { label: "Artikli", href: "/sifarnici/artikli" },
      { label: "Partneri", href: "/sifarnici/partneri" },
      { label: "Magacini", href: "/sifarnici/magacini" },
      { label: "Grupe artikala", href: "/sifarnici/grupe" },
    ],
  },
  {
    label: "Prodaja",
    icon: ShoppingCart,
    children: [
      { label: "Fakture", href: "/prodaja/fakture" },
      { label: "Ponude", href: "/prodaja/ponude" },
      { label: "Otpremnice", href: "/prodaja/otpremnice" },
    ],
  },
  {
    label: "Nabavka",
    icon: FileText,
    children: [
      { label: "Ulazne fakture", href: "/nabavka/fakture" },
      { label: "Prijemnice", href: "/nabavka/prijemnice" },
      { label: "Narudžbenice", href: "/nabavka/narudzbenice" },
    ],
  },
  {
    label: "Proizvodnja",
    icon: Factory,
    children: [
      { label: "Radni nalozi", href: "/proizvodnja/nalozi" },
      { label: "Sastavnice", href: "/proizvodnja/sastavnice" },
      { label: "Recepture", href: "/proizvodnja/recepture" },
    ],
  },
  { label: "Magacin", icon: Warehouse, href: "/magacin" },
  { label: "Partneri", icon: Users, href: "/partneri" },
  { label: "Administracija", icon: Settings, href: "/admin" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, signOut, isSuperAdmin, isLocalAdmin } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Šifarnici"]);

  const filteredNavigation = navigation.filter((item) => {
    if (item.href === "/admin" && !isSuperAdmin && !isLocalAdmin) {
      return false;
    }
    return true;
  });

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (href: string) => location.pathname === href;
  const isParentActive = (children?: { href: string }[]) =>
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
                    {item.children.map((child) => (
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
