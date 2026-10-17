import { NavLink, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/lib/auth";
import { cn } from "@/lib/utils";

const links = [
  { to: "/app/dashboard", label: "Dashboard", superOnly: false },
  { to: "/app/inventory", label: "Inventory", superOnly: false },
  { to: "/app/movements", label: "Movements", superOnly: false },
  { to: "/app/products", label: "Products", superOnly: true },
  { to: "/app/reports", label: "Reports", superOnly: false },
  { to: "/app/users", label: "Users", superOnly: true },
  { to: "/app/settings", label: "Settings", superOnly: true },
];

export default function AppLayout() {
  const { profile, isSuperUser, signOut } = useAuth();
  return (
    <div className="min-h-svh bg-secondary">
      <header className="sticky top-0 z-10 border-b bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo-icon.png"
              alt="Shibaam Enterprises"
              className="h-8 w-8 object-contain rounded shrink-0 shadow-2xs"
            />
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight text-foreground flex items-center gap-1 sm:text-base leading-tight">
                <span className="text-brand-red">SHIBAAM</span>
                <span className="text-brand-blue">ENTERPRISES</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium leading-none hidden sm:inline">
                Stock &amp; Inventory Management
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">
              {profile?.full_name || "Signed in"} · {isSuperUser ? "Super User" : "Staff"}
            </span>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
        <nav aria-label="Main" className="mx-auto max-w-6xl overflow-x-auto px-4">
          <ul className="flex gap-1 pb-2">
            {links
              .filter((l) => !l.superOnly || isSuperUser)
              .map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    className={({ isActive }) =>
                      cn(
                        "block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium",
                        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )
                    }
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl min-w-0 w-full p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
    </div>
  );
}
