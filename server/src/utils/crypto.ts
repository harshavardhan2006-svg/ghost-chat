import crypto from 'node:crypto';

import bcrypt from 'bcrypt';

export const hashValue = async (value: string, saltRounds: number): Promise<string> => bcrypt.hash(value, saltRounds);

export const compareHash = async (value: string, hash: string): Promise<boolean> => bcrypt.compare(value, hash);

export const createSecureToken = (bytes = 32): string => crypto.randomBytes(bytes).toString('hex');

export const createSecureNumericCode = (length: number): string => {
  const upperBound = 10 ** length;
  const value = crypto.randomInt(0, upperBound);

  return value.toString().padStart(length, '0');
};

export const createHmacHash = (value: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(value).digest('hex');
