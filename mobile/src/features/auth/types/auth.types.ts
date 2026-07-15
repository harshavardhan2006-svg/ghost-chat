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

export type AuthPayload = {
  user: AuthenticatedUser;
  tokens: AuthTokens;
};

export type AuthSession = {
  user: AuthenticatedUser;
  tokens: AuthTokens;
};
