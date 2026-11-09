import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/app/lib/auth";
import { FullScreenMessage, RequireAuth, RequireSuperUser } from "@/app/lib/guards";
import AppLayout from "@/app/components/AppLayout";
const LoginPage = lazy(() => import("@/app/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/app/pages/DashboardPage"));
const InventoryPage = lazy(() => import("@/app/pages/InventoryPage"));
const MovementsPage = lazy(() => import("@/app/pages/MovementsPage"));
const ReportsPage = lazy(() => import("@/app/pages/ReportsPage"));
const ProductsPage = lazy(() => import("@/app/pages/ProductsPage"));
const SettingsPage = lazy(() => import("@/app/pages/SettingsPage"));
const UsersPage = lazy(() => import("@/app/pages/UsersPage"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<FullScreenMessage>Loading…</FullScreenMessage>}>
        <Routes>
          {/* The public website is built last; until then the root goes to the login screen. */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="movements" element={<MovementsPage />} />
              <Route path="reports" element={<ReportsPage />} />

              <Route element={<RequireSuperUser />}>
                <Route path="products" element={<ProductsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
