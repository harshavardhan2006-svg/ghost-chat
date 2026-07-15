import * as SecureStore from 'expo-secure-store';

import { type AuthSession } from '../types/auth.types';

const sessionKey = 'ghost.auth.session';

export const saveSession = async (session: AuthSession): Promise<void> => {
  await SecureStore.setItemAsync(sessionKey, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

export const loadSession = async (): Promise<AuthSession | null> => {
  const rawSession = await SecureStore.getItemAsync(sessionKey);

  if (rawSession === null) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    await SecureStore.deleteItemAsync(sessionKey);
    return null;
  }
};

export const clearSession = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(sessionKey);
};
