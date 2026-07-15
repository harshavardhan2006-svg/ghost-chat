import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authApi } from './services/auth-api';
import { clearSession, loadSession, saveSession } from './services/token-storage';
import { type AuthSession } from './types/auth.types';
import { useAuthStore } from './store/auth-store';

type AuthContextValue = {
  session: AuthSession | null;
  booting: boolean;
  busy: boolean;
  error: string | null;
  clearError: () => void;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep Zustand auth-store in sync with Context session
  useEffect(() => {
    const currentZustandToken = useAuthStore.getState().accessToken;
    const contextToken = session?.tokens.accessToken ?? null;
    if (currentZustandToken !== contextToken) {
      void useAuthStore.getState().setSession(session);
    }
  }, [session]);

  const persistSession = useCallback(async (nextSession: AuthSession): Promise<void> => {
    await saveSession(nextSession);
    setSession(nextSession);
  }, []);

  useEffect(() => {
    let mounted = true;

    const restore = async (): Promise<void> => {
      const storedSession = await loadSession();

      if (storedSession === null) {
        if (mounted) {
          setBooting(false);
        }
        return;
      }

      try {
        const refreshed = await authApi.refresh(storedSession.tokens.refreshToken);

        if (mounted) {
          await persistSession(refreshed);
        }
      } catch {
        await clearSession();

        if (mounted) {
          setSession(null);
        }
      } finally {
        if (mounted) {
          setBooting(false);
        }
      }
    };

    void restore();

    return () => {
      mounted = false;
    };
  }, [persistSession]);

  const runAuthAction = useCallback(
    async (action: () => Promise<AuthSession>): Promise<void> => {
      setBusy(true);
      setError(null);

      try {
        const nextSession = await action();
        await persistSession(nextSession);
      } catch (actionError) {
        const message = actionError instanceof Error ? actionError.message : 'Authentication failed';
        setError(message);
        throw actionError;
      } finally {
        setBusy(false);
      }
    },
    [persistSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      booting,
      busy,
      error,
      clearError: () => setError(null),
      login: (input) => runAuthAction(() => authApi.login(input)),
      register: (input) => runAuthAction(() => authApi.register(input)),
      logout: async () => {
        setBusy(true);
        setError(null);

        try {
          if (session !== null) {
            await authApi.logout(session.tokens.accessToken);
          }
        } finally {
          await clearSession();
          setSession(null);
          setBusy(false);
        }
      },
    }),
    [booting, busy, error, runAuthAction, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
