"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { SessionUser } from "@/lib/client/types";

type Ctx = { user: SessionUser | null | undefined; refresh: () => Promise<void> };
const AuthContext = createContext<Ctx>({ user: undefined, refresh: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const refresh = useCallback(async () => { try { setUser(await api.getSession()); } catch { setUser(null); } }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return <AuthContext.Provider value={{ user, refresh }}>{children}</AuthContext.Provider>;
}

// user: undefined = loading, null = signed out.
export const useAuth = () => useContext(AuthContext);
