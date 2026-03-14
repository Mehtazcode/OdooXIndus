'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, ApiError } from '@/lib/client';
import { useRouter } from 'next/navigation';

interface User { userId: string; name: string; email: string; role: 'manager'|'staff'; }
interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const login = async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    setUser(data.user);
    router.push('/dashboard');
  };

  const logout = async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
    router.push('/login');
  };

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
