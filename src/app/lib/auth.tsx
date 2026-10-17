import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabase";
import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  /** True until the session AND (if signed in) the profile have been resolved. */
  loading: boolean;
  isSuperUser: boolean;
  notice: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    // Keep this callback synchronous: never await Supabase calls inside it.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, full_name, role, is_active, created_at, updated_at")
      .eq("id", userId)
      .single()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        // Role and active flag come from the database, never from the token.
        if (error || !data || !data.is_active) {
          setNotice("This account is not active. Contact your administrator.");
          await supabase.auth.signOut();
          setLoaded({ userId, profile: null });
        } else {
          setLoaded({ userId, profile: data });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const profile = userId && loaded?.userId === userId ? loaded.profile : null;
  const profileReady = !userId || loaded?.userId === userId;

  const signIn = useCallback(async (email: string, password: string) => {
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? "Invalid email or password." : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading: !sessionReady || !profileReady,
      isSuperUser: profile?.role === "super_user",
      notice,
      signIn,
      signOut,
    }),
    [session, profile, sessionReady, profileReady, notice, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
