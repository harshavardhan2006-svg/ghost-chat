import { create } from 'zustand';
import { type AuthenticatedUser, type AuthSession } from '../types/auth.types';
import { saveSession, loadSession, clearSession } from '../services/token-storage';

type AuthState = {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setSession: (session: AuthSession | null) => Promise<void>;
  updatePairingStatus: (paired: boolean, partnerId: string | null, chatId: string | null) => void;
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  setSession: async (session) => {
    if (session) {
      await saveSession(session);
      set({
        user: session.user,
        accessToken: session.tokens.accessToken,
        refreshToken: session.tokens.refreshToken,
      });
    } else {
      await clearSession();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
      });
    }
  },
  updatePairingStatus: (paired, partnerId, chatId) => {
    const user = get().user;
    if (user) {
      set({
        user: {
          ...user,
          paired,
          partnerId,
          chatId,
        },
      });
    }
  },
  initialize: async () => {
    try {
      const session = await loadSession();
      if (session) {
        set({
          user: session.user,
          accessToken: session.tokens.accessToken,
          refreshToken: session.tokens.refreshToken,
        });
      }
    } catch {
      // Ignore
    } finally {
      set({ isLoading: false });
    }
  },
  logout: async () => {
    await clearSession();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  },
}));
