import { useEffect, useState, useMemo } from "react";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  UserX,
  UserCheck,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
  Edit2,
  Mail,
  User,
  KeyRound,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { formatDateTime } from "@/app/lib/format";
import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserRole = Database["public"]["Enums"]["user_role"];

export default function UsersPage() {
  const { profile: currentProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [userToChangeRole, setUserToChangeRole] = useState<Profile | null>(
    null,
  );
  const [userToToggleStatus, setUserToToggleStatus] = useState<Profile | null>(
    null,
  );
  const [userToEditName, setUserToEditName] = useState<Profile | null>(null);

  // Load profiles from database
  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active, created_at, updated_at")
        .order("created_at", { ascending: true });

      if (fetchErr) throw fetchErr;
      setProfiles(data || []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load user profiles";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, full_name, role, is_active, created_at, updated_at")
      .order("created_at", { ascending: true })
      .then(({ data, error: fetchErr }) => {
        if (cancelled) return;
        if (fetchErr) {
          setError(fetchErr.message);
        } else {
          setProfiles(data || []);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered rows
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.full_name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);

      const matchesRole = roleFilter === "all" || p.role === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? p.is_active : !p.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [profiles, searchQuery, roleFilter, statusFilter]);

  // Summary counts
  const stats = useMemo(() => {
    const total = profiles.length;
    const active = profiles.filter((p) => p.is_active).length;
    const superUsers = profiles.filter((p) => p.role === "super_user").length;
    const normalUsers = profiles.filter((p) => p.role === "normal_user").length;
    return { total, active, superUsers, normalUsers };
  }, [profiles]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              User Management
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
              <ShieldCheck className="h-3 w-3 text-blue-700" />
              Super User Only
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage authenticated staff accounts, access status, and platform
            authorization roles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs bg-brand-blue hover:bg-brand-blue/90 text-white flex items-center gap-1.5 shadow-xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Staff Member
          </Button>
        </div>
      </div>

      {/* Global Alerts / Notices */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 text-destructive/80 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="p-1 text-emerald-700 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3 bg-surface border">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Total Staff
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-foreground">
            {stats.total}
          </div>
        </Card>

        <Card className="p-3 bg-surface border">
          <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">
            Active Accounts
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-emerald-700">
            {stats.active}
          </div>
        </Card>

        <Card className="p-3 bg-surface border">
          <div className="text-[11px] font-medium text-blue-700 uppercase tracking-wider">
            Super Users
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-blue-700">
            {stats.superUsers}
          </div>
        </Card>

        <Card className="p-3 bg-surface border">
          <div className="text-[11px] font-medium text-slate-700 uppercase tracking-wider">
            Normal Users
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-700">
            {stats.normalUsers}
          </div>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border shadow-xs">
        <CardHeader className="p-4 border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Staff Accounts
              </CardTitle>
              <CardDescription className="text-xs">
                Authoritative profiles stored in PostgreSQL. Role comes strictly
                from the database.
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search name or ID…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(e.target.value as "all" | UserRole)
                }
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All Roles</option>
                <option value="super_user">Super User</option>
                <option value="normal_user">Normal User</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as "all" | "active" | "inactive",
                  )
                }
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Deactivated Only</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading && profiles.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-brand-blue" />
              Loading staff accounts…
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              {searchQuery || roleFilter !== "all" || statusFilter !== "all"
                ? "No staff accounts match your filters."
                : "No staff accounts registered yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface border-b text-muted-foreground font-medium">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Staff Member</th>
                    <th className="py-2.5 px-4 font-semibold">Role</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold">Created</th>
                    <th className="py-2.5 px-4 font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProfiles.map((p) => {
                    const isSelf = p.id === currentProfile?.id;
                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-muted/40 transition-colors ${
                          !p.is_active ? "opacity-60 bg-muted/20" : ""
                        }`}
                      >
                        {/* Name */}
                        <td className="py-3 px-4 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {p.full_name || "Unnamed User"}
                            </span>
                            {isSelf && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                                You
                              </span>
                            )}
                            <button
                              onClick={() => setUserToEditName(p)}
                              title="Edit Display Name"
                              className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3 px-4">
                          {p.role === "super_user" ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
                              <ShieldCheck className="h-3 w-3 text-blue-700" />
                              Super User
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
                              <Shield className="h-3 w-3 text-slate-500" />
                              Normal User
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          {p.is_active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800 border border-rose-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                              Deactivated
                            </span>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {formatDateTime(p.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Role Toggle Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUserToChangeRole(p)}
                              disabled={isSelf}
                              title={
                                isSelf
                                  ? "Cannot change your own role"
                                  : `Change role to ${
                                      p.role === "super_user"
                                        ? "Normal User"
                                        : "Super User"
                                    }`
                              }
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Shield className="h-3.5 w-3.5 mr-1" />
                              {p.role === "super_user" ? "Demote" : "Promote"}
                            </Button>

                            {/* Active/Deactivate Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUserToToggleStatus(p)}
                              disabled={isSelf}
                              title={
                                isSelf
                                  ? "Cannot deactivate your own account"
                                  : p.is_active
                                    ? "Deactivate account"
                                    : "Activate account"
                              }
                              className={`h-7 px-2 text-xs ${
                                p.is_active
                                  ? "text-rose-700 hover:text-rose-900 hover:bg-rose-50"
                                  : "text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50"
                              }`}
                            >
                              {p.is_active ? (
                                <>
                                  <UserX className="h-3.5 w-3.5 mr-1" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                                  Activate
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL 1: ADD NEW USER */}
      {isAddModalOpen && (
        <AddUserModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={(newUserName) => {
            setIsAddModalOpen(false);
            setNotice(`Staff user "${newUserName}" created successfully.`);
            void loadUsers();
          }}
        />
      )}

      {/* MODAL 2: CONFIRM CHANGE ROLE */}
      {userToChangeRole && (
        <ChangeRoleModal
          user={userToChangeRole}
          onClose={() => setUserToChangeRole(null)}
          onSuccess={(name, newRole) => {
            setUserToChangeRole(null);
            setNotice(
              `Role for "${name}" updated to ${
                newRole === "super_user" ? "Super User" : "Normal User"
              }.`,
            );
            void loadUsers();
          }}
        />
      )}

      {/* MODAL 3: CONFIRM ACTIVATE/DEACTIVATE */}
      {userToToggleStatus && (
        <ToggleStatusModal
          user={userToToggleStatus}
          onClose={() => setUserToToggleStatus(null)}
          onSuccess={(name, nowActive) => {
            setUserToToggleStatus(null);
            setNotice(
              `Account for "${name}" has been ${
                nowActive ? "activated" : "deactivated"
              }.`,
            );
            void loadUsers();
          }}
        />
      )}

      {/* MODAL 4: EDIT NAME */}
      {userToEditName && (
        <EditNameModal
          user={userToEditName}
          onClose={() => setUserToEditName(null)}
          onSuccess={(updatedName) => {
            setUserToEditName(null);
            setNotice(`Staff member name updated to "${updatedName}".`);
            void loadUsers();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// MODAL: ADD NEW USER
// =============================================================================
function AddUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (name: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("normal_user");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPasswordValid = password.length >= 10;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError("Please enter the staff member's full name.");
      return;
    }
    if (!isEmailValid) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!isPasswordValid) {
      setError("Password must be at least 10 characters long.");
      return;
    }

    setSaving(true);
    try {
      // 1) Call Edge Function admin-create-user
      const { data, error: fnError } = await supabase.functions.invoke(
        "admin-create-user",
        {
          body: {
            email: cleanEmail,
            password: password,
            full_name: cleanName,
          },
        },
      );

      if (fnError) {
        throw new Error(
          fnError.message || "Failed to create user via Edge Function",
        );
      }

      // Check if function returned an error payload
      if (data && typeof data === "object" && "error" in data) {
        const errCode = (data as { error: string }).error;
        if (errCode === "could_not_create_user") {
          throw new Error(
            "Could not create user. This email address may already be registered.",
          );
        } else if (errCode === "password_too_short") {
          throw new Error("Password must be at least 10 characters long.");
        } else if (errCode === "invalid_email") {
          throw new Error("Invalid email format.");
        } else if (errCode === "forbidden") {
          throw new Error(
            "Access denied: only active Super Users can create staff accounts.",
          );
        } else {
          throw new Error(`Creation failed: ${errCode}`);
        }
      }

      const createdUserId = (data as { id?: string })?.id;

      // 2) If the admin selected "super_user", promote the user via admin_update_profile
      if (role === "super_user" && createdUserId) {
        const { error: rpcErr } = await supabase.rpc("admin_update_profile", {
          p_user_id: createdUserId,
          p_role: "super_user",
        });
        if (rpcErr) {
          console.error(
            "User created as normal user, but promotion to super user failed:",
            rpcErr,
          );
        }
      }

      onSuccess(cleanName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create user";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-2xl border">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-brand-blue" />
            <h2 className="text-base font-bold text-foreground">
              Add New Staff Member
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Security Notice */}
          <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-2.5 text-[11px] text-blue-900 flex items-start gap-2">
            <Info className="h-4 w-4 text-brand-blue shrink-0 mt-0.5" />
            <div>
              <strong>Secure Account Provisioning:</strong> Public registration
              is disabled. This account will be created directly through the
              Supabase Edge Function without exposing server secrets.
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="e.g. Ramesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-9 pl-8 text-xs"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Login Email Address <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="e.g. staff@shibaam.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 pl-8 text-xs font-mono"
                required
              />
            </div>
          </div>

          {/* Initial Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Initial Password <span className="text-destructive">*</span>
              </Label>
              <span
                className={`text-[10px] font-mono ${
                  password.length >= 10
                    ? "text-emerald-700 font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {password.length}/10 chars min
              </span>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Minimum 10 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 pl-8 text-xs font-mono"
                required
              />
            </div>
          </div>

          {/* Initial Role */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Initial Platform Role
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("normal_user")}
                className={`p-2.5 text-left rounded-lg border transition-colors ${
                  role === "normal_user"
                    ? "border-brand-blue bg-blue-50/50 ring-1 ring-brand-blue"
                    : "border-input bg-card hover:bg-surface"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Shield className="h-3.5 w-3.5 text-slate-600" />
                  Normal User
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Standard stock add & remove operations.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole("super_user")}
                className={`p-2.5 text-left rounded-lg border transition-colors ${
                  role === "super_user"
                    ? "border-brand-blue bg-blue-50/50 ring-1 ring-brand-blue"
                    : "border-input bg-card hover:bg-surface"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-blue">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-blue" />
                  Super User
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Full admin: products, units, settings & users.
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                saving || !isPasswordValid || !isEmailValid || !fullName.trim()
              }
              className="bg-brand-blue hover:bg-brand-blue/90 text-white"
            >
              {saving ? "Creating User…" : "Create Staff Account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// MODAL: CHANGE ROLE
// =============================================================================
function ChangeRoleModal({
  user,
  onClose,
  onSuccess,
}: {
  user: Profile;
  onClose: () => void;
  onSuccess: (name: string, newRole: UserRole) => void;
}) {
  const targetRole: UserRole =
    user.role === "super_user" ? "normal_user" : "super_user";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc("admin_update_profile", {
        p_user_id: user.id,
        p_role: targetRole,
      });

      if (rpcErr) throw rpcErr;
      onSuccess(user.full_name || user.id, targetRole);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to change user role";
      if (msg.includes("cannot_change_own_access")) {
        setError("Security Guard: You cannot change your own role.");
      } else if (msg.includes("last_super_user")) {
        setError(
          "Security Guard: At least one active Super User must always remain in the system.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-sm rounded-xl bg-card p-6 shadow-2xl border">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-blue" />
            <h2 className="text-base font-bold text-foreground">
              Change Staff Role
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 space-y-3 text-xs">
          <p className="text-muted-foreground">
            You are about to change the system role for{" "}
            <strong className="text-foreground">
              {user.full_name || user.id}
            </strong>
            :
          </p>

          <div className="rounded-lg bg-surface p-3 border flex items-center justify-between">
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Current Role
              </span>
              <span className="font-semibold capitalize text-foreground">
                {user.role.replace("_", " ")}
              </span>
            </div>
            <span className="text-muted-foreground">➔</span>
            <div>
              <span className="text-muted-foreground block text-[11px]">
                New Role
              </span>
              <strong className="text-brand-blue capitalize">
                {targetRole.replace("_", " ")}
              </strong>
            </div>
          </div>

          {targetRole === "super_user" ? (
            <div className="rounded-lg bg-blue-50 p-2.5 text-[11px] text-blue-900 border border-blue-200">
              <strong>Super User privileges granted:</strong> This staff member
              will be able to manage all products, units, conversion rules,
              system settings, and user accounts.
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900 border border-amber-200">
              <strong>Super User privileges revoked:</strong> This staff member
              will only be able to view permitted inventory and record stock
              additions and removals.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={saving}
            className="bg-brand-blue hover:bg-brand-blue/90 text-white"
          >
            {saving
              ? "Updating…"
              : `Confirm Change to ${targetRole === "super_user" ? "Super User" : "Normal User"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MODAL: ACTIVATE / DEACTIVATE USER
// =============================================================================
function ToggleStatusModal({
  user,
  onClose,
  onSuccess,
}: {
  user: Profile;
  onClose: () => void;
  onSuccess: (name: string, nowActive: boolean) => void;
}) {
  const targetStatus = !user.is_active;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc("admin_update_profile", {
        p_user_id: user.id,
        p_is_active: targetStatus,
      });

      if (rpcErr) throw rpcErr;
      onSuccess(user.full_name || user.id, targetStatus);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update access status";
      if (msg.includes("cannot_change_own_access")) {
        setError("Security Guard: You cannot deactivate your own account.");
      } else if (msg.includes("last_super_user")) {
        setError(
          "Security Guard: Cannot deactivate the last remaining active Super User.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-sm rounded-xl bg-card p-6 shadow-2xl border">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            {targetStatus ? (
              <UserCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <UserX className="h-5 w-5 text-destructive" />
            )}
            <h2 className="text-base font-bold text-foreground">
              {targetStatus ? "Activate Account" : "Deactivate Account"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 space-y-3 text-xs">
          <p className="text-muted-foreground">
            Are you sure you want to {targetStatus ? "activate" : "deactivate"}{" "}
            platform access for{" "}
            <strong className="text-foreground">
              {user.full_name || user.id}
            </strong>
            ?
          </p>

          {!targetStatus ? (
            <div className="rounded-lg bg-rose-50 p-2.5 text-[11px] text-rose-900 border border-rose-200">
              <strong>Immediate Access Revocation:</strong> A deactivated user
              fails every protected operation immediately and will be logged out
              upon their next request. Their historical movements and audit logs
              remain strictly preserved.
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-50 p-2.5 text-[11px] text-emerald-900 border border-emerald-200">
              <strong>Restoring Platform Access:</strong> The user will be
              permitted to sign in again with their existing credentials.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={saving}
            className={
              targetStatus
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-destructive hover:bg-destructive/90 text-white"
            }
          >
            {saving
              ? "Updating…"
              : targetStatus
                ? "Activate Account"
                : "Deactivate Account"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MODAL: EDIT NAME
// =============================================================================
function EditNameModal({
  user,
  onClose,
  onSuccess,
}: {
  user: Profile;
  onClose: () => void;
  onSuccess: (updatedName: string) => void;
}) {
  const [name, setName] = useState(user.full_name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError("Name cannot be empty.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc("admin_update_profile", {
        p_user_id: user.id,
        p_full_name: clean,
      });

      if (rpcErr) throw rpcErr;
      onSuccess(clean);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update name";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-sm rounded-xl bg-card p-6 shadow-2xl border">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-brand-blue" />
            <h2 className="text-base font-bold text-foreground">
              Edit Staff Name
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Full Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs"
              required
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || !name.trim()}
              className="bg-brand-blue hover:bg-brand-blue/90 text-white"
            >
              {saving ? "Saving…" : "Save Name"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
