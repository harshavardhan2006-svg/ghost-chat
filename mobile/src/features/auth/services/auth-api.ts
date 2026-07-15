import { requestApi } from '../../../shared/api/api-client';
import { type AuthPayload, type AuthenticatedUser } from '../types/auth.types';

type AuthResponseData = AuthPayload;

type ProfileResponseData = {
  user: AuthenticatedUser;
};

export const authApi = {
  register: async (input: { email: string; password: string }): Promise<AuthPayload> =>
    requestApi<AuthResponseData>('/auth/register', {
      method: 'POST',
      body: input,
    }),

  login: async (input: { email: string; password: string }): Promise<AuthPayload> =>
    requestApi<AuthResponseData>('/auth/login', {
      method: 'POST',
      body: input,
    }),

  refresh: async (refreshToken: string): Promise<AuthPayload> =>
    requestApi<AuthResponseData>('/auth/refresh-token', {
      method: 'POST',
      body: { refreshToken },
    }),

  logout: async (accessToken: string): Promise<void> => {
    await requestApi<{ loggedOut: boolean }>('/auth/logout', {
      method: 'POST',
      accessToken,
    });
  },

  me: async (accessToken: string): Promise<AuthenticatedUser> => {
    const data = await requestApi<ProfileResponseData>('/auth/me', {
      accessToken,
    });

    return data.user;
  },
};
