import { Types } from 'mongoose';

import { AppError } from '../../../common/errors/app-error';
import { compareHash, hashValue } from '../../../utils/crypto';
import { env } from '../../../config/env';
import { UserModel, type UserDocument } from '../models/user.model';
import { type AuthResponse, type AuthTokens, type AuthenticatedUser } from '../types/auth.types';
import { type LoginInput, type RegisterInput } from '../schemas/auth.schemas';
import { createAccessToken, createRefreshToken, verifyRefreshToken } from './token.service';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toIdString = (value: Types.ObjectId | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return value.toString();
};

const toAuthenticatedUser = (user: UserDocument): AuthenticatedUser => {
  const partnerId = toIdString(user.pairing.partnerId);
  const chatId = toIdString(user.pairing.chatId);

  return {
    id: user._id.toString(),
    email: user.email,
    paired: partnerId !== null && chatId !== null,
    partnerId,
    chatId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
};

const createTokens = async (user: UserDocument): Promise<AuthTokens> => {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
  };

  const accessToken = createAccessToken(payload);
  const refreshToken = createRefreshToken(payload);
  user.refreshTokenHash = await hashValue(refreshToken, env.BCRYPT_SALT_ROUNDS);
  await user.save();

  return {
    accessToken,
    refreshToken,
  };
};

export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  const email = normalizeEmail(input.email);
  const existingUser = await UserModel.exists({ email });

  if (existingUser !== null) {
    throw new AppError({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'An account with this email already exists',
    });
  }

  const passwordHash = await hashValue(input.password, env.BCRYPT_SALT_ROUNDS);
  const user = await UserModel.create({
    email,
    passwordHash,
  });
  const tokens = await createTokens(user);

  return {
    user: toAuthenticatedUser(user),
    tokens,
  };
};

export const login = async (input: LoginInput): Promise<AuthResponse> => {
  const email = normalizeEmail(input.email);
  const user = await UserModel.findOne({ email }).select('+passwordHash +refreshTokenHash');

  if (user === null) {
    throw new AppError({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid email or password',
    });
  }

  const passwordMatches = await compareHash(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid email or password',
    });
  }

  user.lastLoginAt = new Date();
  const tokens = await createTokens(user);

  return {
    user: toAuthenticatedUser(user),
    tokens,
  };
};

export const refresh = async (refreshToken: string): Promise<AuthResponse> => {
  const payload = verifyRefreshToken(refreshToken);
  const user = await UserModel.findById(payload.userId).select('+refreshTokenHash');

  if (user === null || user.refreshTokenHash === null) {
    throw new AppError({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid refresh token',
    });
  }

  const tokenMatches = await compareHash(refreshToken, user.refreshTokenHash);

  if (!tokenMatches || user.email !== payload.email) {
    user.refreshTokenHash = null;
    await user.save();

    throw new AppError({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid refresh token',
    });
  }

  const tokens = await createTokens(user);

  return {
    user: toAuthenticatedUser(user),
    tokens,
  };
};

export const logout = async (userId: string): Promise<void> => {
  await UserModel.findByIdAndUpdate(userId, {
    $set: {
      refreshTokenHash: null,
    },
  });
};

export const getProfile = async (userId: string): Promise<AuthenticatedUser> => {
  const user = await UserModel.findById(userId);

  if (user === null) {
    throw new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'User not found',
    });
  }

  return toAuthenticatedUser(user);
};
