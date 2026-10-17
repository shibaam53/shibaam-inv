import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/app/lib/auth";

export function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-svh place-items-center p-6 text-sm text-muted-foreground">{children}</div>;
}

/** UI convenience only. Real enforcement is RLS + RPC checks in the database. */
export function RequireAuth() {
  const { loading, session, profile } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenMessage>Loading…</FullScreenMessage>;
  if (!session || !profile) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RequireSuperUser() {
  const { isSuperUser } = useAuth();
  if (!isSuperUser) return <Navigate to="/app/dashboard" replace />;
  return <Outlet />;
}
