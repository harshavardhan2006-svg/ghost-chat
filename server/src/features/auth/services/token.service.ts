import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../../../config/env';
import { AppError } from '../../../common/errors/app-error';
import { type AccessTokenPayload, type RefreshTokenPayload } from '../types/auth.types';

type TokenExpiration = NonNullable<SignOptions['expiresIn']>;

const accessTokenOptions: SignOptions = {
  expiresIn: env.JWT_EXPIRES_IN as TokenExpiration,
};

const refreshTokenOptions: SignOptions = {
  expiresIn: env.JWT_REFRESH_EXPIRES_IN as TokenExpiration,
};

export const createAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, accessTokenOptions);

export const createRefreshToken = (payload: Omit<RefreshTokenPayload, 'tokenType'>): string =>
  jwt.sign({ ...payload, tokenType: 'refresh' }, env.JWT_REFRESH_SECRET, refreshTokenOptions);

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);

    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string' ||
      payload.tokenType !== 'refresh'
    ) {
      throw new AppError({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid refresh token',
      });
    }

    return {
      userId: payload.userId,
      email: payload.email,
      tokenType: 'refresh',
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid refresh token',
    });
  }
};
