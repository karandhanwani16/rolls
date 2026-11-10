import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Users,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  BoxesIcon,
  TruckIcon,
  ShoppingBag,
  ShoppingCart,
  BarChart,
  Calculator,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  LayoutDashboard,
  Undo2,
  Clock3,
  Handshake,
  BookUser,
  Warehouse,
  BadgeIndianRupee,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type NavLeaf = {
  label: string;
  to: string;
  icon?: any;
};

type NavGroup = {
  id: string;
  label: string;
  icon: any;
  items: NavLeaf[];
  match?: (pathname: string) => boolean;
};

const topLinks: NavLeaf[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
];

const navGroups: NavGroup[] = [
  {
    id: "parties",
    label: "Parties",
    icon: BookUser,
    items: [
      { label: "Customers", to: "/customers", icon: Users },
      { label: "Watav Vendors", to: "/watav-vendors", icon: Handshake },
      { label: "Suppliers", to: "/suppliers", icon: TruckIcon },
    ],
    match: (p) =>
      p.startsWith("/customers") ||
      p.startsWith("/watav-vendors") ||
      p.startsWith("/suppliers"),
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Warehouse,
    items: [
      { label: "Godowns", to: "/godowns", icon: BoxesIcon },
      { label: "Products", to: "/products", icon: Package },
    ],
    match: (p) => p.startsWith("/godowns") || p.startsWith("/products"),
  },
  {
    id: "trading",
    label: "Trading",
    icon: ShoppingBag,
    items: [
      { label: "Sales", to: "/sales", icon: ShoppingBag },
      { label: "Purchase", to: "/purchases", icon: ShoppingCart },
      { label: "Sales Return", to: "/sales-returns", icon: Undo2 },
      { label: "Purchase Return", to: "/purchase-returns", icon: Undo2 },
    ],
    match: (p) =>
      (p.startsWith("/sales") && !p.startsWith("/sales-returns")) ||
      (p.startsWith("/purchases") && !p.startsWith("/purchase-returns")) ||
      p.startsWith("/sales-returns") ||
      p.startsWith("/purchase-returns"),
  },
  {
    id: "payments",
    label: "Payments",
    icon: BadgeIndianRupee,
    items: [
      { label: "Payment In", to: "/payments-in", icon: ArrowDownToLine },
      { label: "Payment Out", to: "/payments-out", icon: ArrowUpFromLine },
      { label: "Bill to Bill", to: "/bill-to-bill", icon: Calculator },
      { label: "Pending Watav", to: "/watav-pending", icon: Clock3 },
      { label: "Transactions", to: "/transactions", icon: CreditCard },
    ],
    match: (p) =>
      p.startsWith("/payments-in") ||
      p.startsWith("/payments-out") ||
      p.startsWith("/bill-to-bill") ||
      p.startsWith("/watav-pending") ||
      p.startsWith("/transactions"),
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart,
    items: [
      { label: "Stock Report", to: "/reports/stock" },
      { label: "Customer Report", to: "/reports/customers" },
      { label: "Supplier Report", to: "/reports/suppliers" },
      { label: "Watav Report", to: "/reports/watav" },
      { label: "Sales Report", to: "/reports/sales" },
      { label: "Outstanding Report", to: "/reports/outstanding" },
      { label: "Customer Pending Bills", to: "/reports/customer-pending-bills" },
      { label: "Payment In Report", to: "/reports/payments-in" },
      { label: "Payment Out Report", to: "/reports/payments-out" },
      { label: "Purchase Report", to: "/reports/purchases" },
      { label: "Purchase Outstanding", to: "/reports/purchase-outstanding" },
      { label: "Supplier Pending Bills", to: "/reports/supplier-pending-bills" },
      { label: "Sales Return Report", to: "/reports/sales-returns" },
      { label: "Purchase Return Report", to: "/reports/purchase-returns" },
    ],
    match: (p) => p.startsWith("/reports/"),
  },
];

const bottomLinks: NavLeaf[] = [
  { label: "Change Password", to: "/settings", icon: Settings },
];

const flatShortcutItems = [
  ...topLinks,
  ...navGroups.flatMap((g) => g.items),
  ...bottomLinks,
];

function NavLinkItem({
  item,
  active,
  collapsed,
  nested,
  onClick,
}: {
  item: NavLeaf;
  active: boolean;
  collapsed: boolean;
  nested?: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-3 rounded-md transition-colors",
        nested ? "py-1.5 px-2 text-sm" : "p-2",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : nested
            ? "text-sidebar-foreground/85 hover:bg-sidebar-accent/30"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
    >
      {Icon && <Icon size={nested ? 16 : 20} className="shrink-0" />}
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function NavSection({
  group,
  open,
  onOpenChange,
  collapsed,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = group.icon;
  const sectionActive = group.match?.(pathname) ?? false;

  if (collapsed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center p-2 rounded-md cursor-pointer",
          sectionActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}
        title={group.label}
        onClick={() => {
          const first = group.items[0];
          if (first) onNavigate?.();
          // parent handles navigation via title — use first item
        }}
        role="button"
      >
        <Link
          to={group.items[0]?.to || "/dashboard"}
          className="flex items-center justify-center"
          onClick={onNavigate}
          title={group.label}
        >
          <Icon size={20} />
        </Link>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center justify-between px-3 py-2 rounded-md text-sidebar-foreground group",
          sectionActive
            ? "bg-sidebar-accent/40"
            : "hover:bg-sidebar-accent/50"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon size={20} className="shrink-0" />
          <span className="font-medium truncate">{group.label}</span>
        </div>
        <ChevronRight
          size={16}
          className={cn(
            "shrink-0 transition-transform text-sidebar-foreground/70",
            open ? "rotate-90" : ""
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-3 mt-1 space-y-0.5 border-l border-sidebar-border/60 ml-4">
        {group.items.map((item) => {
          const active =
            pathname === item.to ||
            pathname.startsWith(`${item.to}/`);
          return (
            <NavLinkItem
              key={item.to}
              item={item}
              nested
              active={active}
              collapsed={false}
              onClick={onNavigate}
            />
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, user } = useAuth();

  const activeGroupId = useMemo(() => {
    const match = navGroups.find((g) => g.match?.(location.pathname));
    return match?.id || null;
  }, [location.pathname]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      initial[g.id] = false;
    });
    return initial;
  });

  // Auto-expand the section for the current route
  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups((prev) => ({ ...prev, [activeGroupId]: true }));
  }, [activeGroupId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const numKey = parseInt(event.key);
        if (!isNaN(numKey) && numKey > 0 && numKey <= 9) {
          event.preventDefault();
          const item = flatShortcutItems[numKey - 1];
          if (item) {
            navigate(item.to);
            if (isMobile) setMobileOpen(false);
          }
        }

        const key = event.key.toLowerCase();
        if (key === "r") {
          event.preventDefault();
          setOpenGroups((prev) => ({ ...prev, reports: !prev.reports }));
          if (collapsed) navigate("/reports/customers");
        }
        if (key === "l") {
          event.preventDefault();
          handleLogout();
        }
        if (key === "i") {
          event.preventDefault();
          navigate("/payments-in");
          if (isMobile) setMobileOpen(false);
        }
        if (key === "o") {
          event.preventDefault();
          navigate("/payments-out");
          if (isMobile) setMobileOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, collapsed, isMobile]);

  const handleLogout = async () => {
    try {
      const success = await logout();
      if (success) navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const closeMobile = isMobile ? () => setMobileOpen(false) : undefined;
  const showLabels = !collapsed || isMobile;

  const sidebarHeader = (
    <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
      {showLabels && (
        <div>
          <h1 className="font-bold text-xl">T. A. TEX</h1>
          {user && (
            <p className="text-xs text-sidebar-foreground/70">
              {user.full_name || "User"}
            </p>
          )}
        </div>
      )}

      {(isMobile || !collapsed) && (
        <Button
          variant="ghost"
          size="icon"
          onClick={isMobile ? () => setMobileOpen(false) : () => setCollapsed(true)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {isMobile ? <X size={20} /> : <ChevronRight size={20} />}
        </Button>
      )}

      {!isMobile && collapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="text-sidebar-foreground hover:bg-sidebar-accent mx-auto"
        >
          <Menu size={20} />
        </Button>
      )}
    </div>
  );

  const sidebarContent = (
    <div
      className={cn(
        "h-full flex flex-col bg-sidebar text-sidebar-foreground transition-all",
        collapsed ? "w-16" : "w-60",
        isMobile && "w-60"
      )}
    >
      {sidebarHeader}

      <div className="flex-1 overflow-auto p-3 space-y-1">
        {topLinks.map((item) => (
          <NavLinkItem
            key={item.to}
            item={item}
            active={location.pathname === item.to}
            collapsed={!showLabels}
            onClick={closeMobile}
          />
        ))}

        <div className={cn("pt-2 space-y-1", showLabels && "border-t border-sidebar-border mt-2")}>
          {navGroups.map((group) => (
            <NavSection
              key={group.id}
              group={group}
              open={!!openGroups[group.id]}
              onOpenChange={(open) =>
                setOpenGroups((prev) => ({ ...prev, [group.id]: open }))
              }
              collapsed={!showLabels}
              pathname={location.pathname}
              onNavigate={closeMobile}
            />
          ))}
        </div>

        <div className={cn("pt-2 space-y-1", showLabels && "border-t border-sidebar-border mt-2")}>
          {bottomLinks.map((item) => (
            <NavLinkItem
              key={item.to}
              item={item}
              active={location.pathname === item.to}
              collapsed={!showLabels}
              onClick={closeMobile}
            />
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleLogout}
        >
          <LogOut size={20} className={showLabels ? "mr-2" : ""} />
          {showLabels && (
            <div className="flex items-center justify-between w-full">
              <span>Logout</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-sidebar-accent/30 rounded border border-sidebar-border/50">
                Alt + L
              </kbd>
            </div>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {isMobile && (
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 left-4 z-20 bg-white"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={20} />
        </Button>
      )}

      {isMobile ? (
        <>
          {mobileOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-90 z-30"
              onClick={() => setMobileOpen(false)}
            />
          )}
          <div
            className={cn(
              "fixed inset-0 z-50 transform transition-transform duration-300 ease-in-out w-auto",
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            {sidebarContent}
          </div>
        </>
      ) : (
        sidebarContent
      )}
    </>
  );
};

export default Sidebar;
