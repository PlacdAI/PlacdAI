// ─────────────────────────────────────────────────────────────
// Auth context — tracks the Supabase session + exposes helpers.
//
// DEV BYPASS
//   The "Skip Login (Dev Only)" button on /login sets a localStorage flag
//   which makes useAuth() report a fake signed-in user. Remove the button
//   from src/routes/login.tsx (and delete the DEV_BYPASS_KEY constant here)
//   before shipping to production.
// ─────────────────────────────────────────────────────────────
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export const DEV_BYPASS_KEY = "placdai_dev_bypass";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDevBypass: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function readDevBypass(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DEV_BYPASS_KEY) === "1";
}

const DEV_USER = {
  id: "dev-bypass-user",
  email: "dev@placdai.local",
} as unknown as User;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDevBypass, setIsDevBypass] = useState(false);

  useEffect(() => {
    // Dev bypass check
    if (readDevBypass()) {
      setIsDevBypass(true);
      setUser(DEV_USER);
      setLoading(false);
      return;
    }

    // Subscribe FIRST, then fetch existing session.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (isDevBypass) {
      window.localStorage.removeItem(DEV_BYPASS_KEY);
      setIsDevBypass(false);
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, isDevBypass, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
