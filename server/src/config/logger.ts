import { env } from './env';

export const loggerOptions = {
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'CLOUDINARY_API_SECRET',
      'MONGO_URI',
      'REDIS_URL',
    ],
    censor: '[redacted]',
  },
};
