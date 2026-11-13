import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  Package,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/lib/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  superOnly: boolean;
}

const navLinks: NavItem[] = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, superOnly: false },
  { to: "/app/inventory", label: "Inventory", icon: Boxes, superOnly: false },
  { to: "/app/movements", label: "Movements", icon: ArrowLeftRight, superOnly: false },
  { to: "/app/products", label: "Products", icon: Package, superOnly: true },
  { to: "/app/reports", label: "Reports", icon: BarChart3, superOnly: false },
  { to: "/app/users", label: "Users", icon: Users, superOnly: true },
  { to: "/app/settings", label: "Settings", icon: Settings, superOnly: true },
];

export default function AppLayout() {
  const { profile, session, isSuperUser, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const visibleLinks = navLinks.filter((l) => !l.superOnly || isSuperUser);

  // Bottom navigation primary items (up to 4 items + "More" menu button)
  const mobilePrimaryLinks = [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/inventory", label: "Inventory", icon: Boxes },
    { to: "/app/movements", label: "Movements", icon: ArrowLeftRight },
    { to: "/app/reports", label: "Reports", icon: BarChart3 },
  ];

  const isMoreActive =
    location.pathname.startsWith("/app/products") ||
    location.pathname.startsWith("/app/users") ||
    location.pathname.startsWith("/app/settings");

  return (
    <div className="flex min-h-svh flex-col bg-secondary">
      {/* =====================================================================
          HEADER (Desktop & Mobile)
          ===================================================================== */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md pt-[env(safe-area-inset-top)] shadow-2xs">
        {/* Top Header Row */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          {/* Brand Logo & Name */}
          <NavLink to="/app/dashboard" className="flex items-center gap-2.5 group">
            <img
              src="/logo-icon.png"
              alt="Shibaam Enterprises"
              className="h-8 w-8 object-contain rounded-lg shrink-0 shadow-2xs border border-border/50 bg-white p-0.5 transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-black tracking-tight text-foreground flex items-center gap-1 leading-tight">
                <span className="text-brand-red">SHIBAAM</span>
                <span className="text-brand-blue">ENTERPRISES</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium leading-none hidden sm:inline">
                Stock &amp; Inventory Management
              </span>
            </div>
          </NavLink>

          {/* Desktop Right User Info & Sign Out */}
          <div className="hidden md:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 rounded-lg border bg-surface/60 px-2.5 py-1 text-foreground">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue font-bold text-[10px]">
                {profile?.full_name?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="font-medium max-w-[150px] truncate">
                {profile?.full_name || "Signed in"}
              </span>
              <span className="text-muted-foreground">·</span>
              <span
                className={`rounded px-1.5 py-0.2 font-semibold text-[10px] ${
                  isSuperUser
                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {isSuperUser ? "Super User" : "Staff"}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void signOut()}
              className="h-8 text-xs gap-1.5 border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </Button>
          </div>

          {/* Mobile Right Controls: Role Badge + Hamburger Menu Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <span
              className={`rounded-full px-2 py-0.5 font-bold text-[10px] ${
                isSuperUser
                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
            >
              {isSuperUser ? "Super User" : "Staff"}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(true)}
              className="h-8 w-8 p-0 text-foreground"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Desktop Navigation Tabs with Animated Underline Effect (Hidden on Mobile) */}
        <nav aria-label="Main Navigation" className="hidden md:block border-t border-border/60 bg-background/60">
          <div className="mx-auto max-w-6xl px-4">
            <ul className="flex items-center gap-1 sm:gap-2">
              {visibleLinks.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors hover:text-foreground",
                        isActive
                          ? "text-brand-blue font-bold"
                          : "text-muted-foreground"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <l.icon
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                            isActive ? "text-brand-blue" : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        <span>{l.label}</span>
                        {/* Animated Underline Indicator */}
                        <span
                          className={cn(
                            "absolute -bottom-[1px] inset-x-2 h-[2.5px] rounded-t-full bg-brand-blue transition-all duration-300 ease-out origin-center",
                            isActive
                              ? "opacity-100 scale-x-100"
                              : "opacity-0 scale-x-0 group-hover:opacity-40 group-hover:scale-x-75"
                          )}
                        />
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>

      {/* =====================================================================
          MAIN BODY CONTENT
          ===================================================================== */}
      <main className="mx-auto max-w-6xl min-w-0 w-full flex-1 p-3.5 sm:p-4 pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* =====================================================================
          GLOBAL FOOTER (Desktop & Mobile)
          ===================================================================== */}
      <footer className="border-t border-border/60 bg-card/60 text-muted-foreground py-3.5 px-4 text-xs pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-4">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="text-[11px] sm:text-xs">
            &copy; {new Date().getFullYear()} Shibaam Enterprises.
          </div>
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs">
            <span>Created by</span>
            <a
              href="https://hmcreations53.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-brand-blue hover:underline transition-colors"
            >
              HMCREATIONS53
            </a>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          MOBILE BOTTOM NAVIGATION BAR (Thumb-Friendly, Mobile Only)
          ===================================================================== */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom)] shadow-lg"
      >
        <div className="grid grid-cols-5 items-center h-14 px-1">
          {mobilePrimaryLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center h-full gap-0.5 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-brand-blue font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* "More" Menu Button (opens mobile sheet for Products, Users, Settings, Profile) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center h-full gap-0.5 text-[10px] font-medium transition-colors",
              isMoreActive
                ? "text-brand-blue font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="More navigation items"
          >
            <Menu className="h-4 w-4 shrink-0" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* =====================================================================
          MOBILE SLIDE-OVER DRAWER ("More" Sheet)
          ===================================================================== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-xs bg-background h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-2">
                <img
                  src="/logo-icon.png"
                  alt="Shibaam Enterprises"
                  className="h-7 w-7 object-contain rounded-md"
                />
                <span className="font-bold text-sm tracking-tight">Navigation</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* User Account Summary Card */}
            <div className="p-4 border-b bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue font-bold text-sm border border-brand-blue/20">
                  {profile?.full_name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs text-foreground truncate">
                    {profile?.full_name || "Signed in"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {session?.user?.email || ""}
                  </p>
                  <span
                    className={`inline-block mt-1 rounded px-1.5 py-0.2 font-semibold text-[9px] ${
                      isSuperUser
                        ? "bg-purple-100 text-purple-800 border border-purple-200"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {isSuperUser ? "Super User" : "Staff User"}
                  </span>
                </div>
              </div>
            </div>

            {/* Links List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                All Destinations
              </p>
              {visibleLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors",
                      isActive
                        ? "bg-brand-blue text-white font-bold"
                        : "text-foreground hover:bg-accent"
                    )
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <l.icon className="h-4 w-4 shrink-0" />
                    <span>{l.label}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                </NavLink>
              ))}
            </div>

            {/* Drawer Footer with Sign Out */}
            <div className="p-4 border-t bg-surface/30">
              <Button
                variant="outline"
                className="w-full text-xs gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                onClick={() => void signOut()}
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
