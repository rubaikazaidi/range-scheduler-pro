import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "coach" | "student" | "admin";
export type ProfileStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  full_name: string;
  primary_branch_id: string | null;
  status: ProfileStatus;
}

interface AuthState {
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isCoach: boolean;
  isStudent: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,primary_branch_id,status").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((prof as Profile | null) ?? null);
    setRoles(((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role));
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setLoading(true);
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => {
          void loadUserData(sess.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) void loadUserData(sess.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (user) await loadUserData(user.id);
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{
      loading, user, session, profile, roles,
      isCoach: roles.includes("coach") || roles.includes("admin"),
      isStudent: roles.includes("student"),
      isAdmin: roles.includes("admin"),
      refresh, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
