export type AuthenticatedUser = {
  id: string;
  email: string;
  paired: boolean;
  partnerId: string | null;
  chatId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponse = {
  user: AuthenticatedUser;
  tokens: AuthTokens;
};

export type RefreshTokenPayload = {
  userId: string;
  email: string;
  tokenType: 'refresh';
};

export type AccessTokenPayload = {
  userId: string;
  email: string;
};
