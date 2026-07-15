import 'dotenv/config';

import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().min(1).default('/api/v1'),
  CLIENT_URL: z.string().url(),
  TRUST_PROXY: z.coerce.boolean().default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().optional(),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('30d'),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(10_485_760),
  MAX_IMAGE_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(8_388_608),
  MAX_VOICE_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(15_728_640),
  CLOUDINARY_MEDIA_FOLDER: z.string().min(1).default('ghost/media'),
  PAIRING_CODE_LENGTH: z.coerce.number().pipe(z.literal(6)).default(6),
  PAIRING_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  SOCKET_PING_INTERVAL_MS: z.coerce.number().int().positive().default(25_000),
  SOCKET_PING_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  SOCKET_PRESENCE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const message = z.prettifyError(parsedEnvironment.error);
  throw new Error(`Invalid environment configuration:\n${message}`);
}

export const env = parsedEnvironment.data;
export type Environment = typeof env;
