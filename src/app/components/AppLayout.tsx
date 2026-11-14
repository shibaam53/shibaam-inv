import { useState, useEffect, useRef } from "react";
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
  Smartphone,
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
  const [installPrompt, setInstallPrompt] = useState<{
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  } | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Check standalone mode and capture PWA install prompt
  useEffect(() => {
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandaloneMode);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(
        e as unknown as {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
        }
      );
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      setIsStandalone(true);
    }
  };

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

  // Auto-hide mobile header when scrolling down; reveal when scrolling up
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY =
            window.pageYOffset ||
            window.scrollY ||
            document.documentElement.scrollTop ||
            document.body.scrollTop ||
            0;

          // Apply hide/show behavior on mobile viewports (< 768px)
          if (window.innerWidth < 768) {
            if (currentY > lastScrollY.current + 6 && currentY > 40) {
              // Scrolling down past 40px -> hide header to maximize screen space
              setIsHeaderVisible(false);
            } else if (currentY < lastScrollY.current - 6 || currentY <= 40) {
              // Scrolling up or at the top -> reveal header immediately
              setIsHeaderVisible(true);
            }
          } else {
            // Desktop is always visible and sticky
            setIsHeaderVisible(true);
          }
          lastScrollY.current = Math.max(0, currentY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    <div className="flex min-h-svh w-full max-w-full flex-col bg-secondary">
      {/* =====================================================================
          HEADER (Auto-hides on Mobile scroll-down for maximum space; Sticky on Desktop)
          ===================================================================== */}
      <header
        className={cn(
          "sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md pt-[env(safe-area-inset-top)] shadow-2xs transition-transform duration-300 md:translate-y-0",
          isHeaderVisible ? "translate-y-0" : "-translate-y-full md:translate-y-0",
        )}
      >
        {/* Top Header Row */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
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
          <div className="mx-auto max-w-7xl px-4">
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
      <main className="mx-auto max-w-7xl min-w-0 w-full flex-1 p-3.5 sm:p-4 pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* =====================================================================
          GLOBAL FOOTER (Desktop Only — on mobile it lives inside Drawer)
          ===================================================================== */}
      <footer className="hidden md:block border-t border-border/60 bg-card/60 text-muted-foreground py-3.5 px-4 text-xs">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
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

          {/* Drawer Panel — 65% screen width (compact standard mobile drawer) */}
          <div className="relative w-[65vw] max-w-[280px] min-w-[240px] bg-background h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b px-3.5 py-3">
              <div className="flex items-center gap-2">
                <img
                  src="/logo-icon.png"
                  alt="Shibaam Enterprises"
                  className="h-6 w-6 object-contain rounded-md"
                />
                <span className="font-bold text-xs tracking-tight">Navigation</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* User Account Summary Card */}
            <div className="px-3.5 py-3 border-b bg-surface/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue font-bold text-xs border border-brand-blue/20">
                  {profile?.full_name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs text-foreground truncate leading-tight">
                    {profile?.full_name || "Signed in"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate leading-tight">
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

            {/* Install PWA Prompt (Only if installable & not already installed) */}
            {installPrompt && !isStandalone && (
              <div className="p-3 border-t bg-brand-blue/5">
                <Button
                  variant="outline"
                  className="w-full text-xs font-semibold gap-2 border-brand-blue/30 text-brand-blue hover:bg-brand-blue hover:text-white"
                  onClick={handleInstallClick}
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Install Shibaam App</span>
                </Button>
              </div>
            )}

            {/* Drawer Footer with Sign Out & Attribution */}
            <div className="p-3 border-t bg-surface/30 space-y-2">
              <Button
                variant="outline"
                className="w-full text-xs gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                onClick={() => void signOut()}
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </Button>
              <div className="pt-1.5 text-center text-[10px] text-muted-foreground space-y-0.5">
                <div>&copy; {new Date().getFullYear()} Shibaam Enterprises.</div>
                <div>
                  Created by{" "}
                  <a
                    href="https://hmcreations53.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-brand-blue hover:underline"
                  >
                    HMCREATIONS53
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
