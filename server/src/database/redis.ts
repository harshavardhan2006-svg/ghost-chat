import { createClient, type RedisClientType } from 'redis';

import { env } from '../config/env';

let redisClient: RedisClientType | null = null;
let isRedisDisabled = true;

export const getRedisClient = (): RedisClientType | null => {
  if (isRedisDisabled || !env.REDIS_URL) {
    return null;
  }
  if (redisClient === null) {
    redisClient = createClient({ url: env.REDIS_URL });
  }

  return redisClient;
};

export const connectRedis = async (): Promise<RedisClientType | null> => {
  const client = getRedisClient();
  if (client === null) {
    return null;
  }

  try {
    if (!client.isOpen) {
      await client.connect();
    }
    return client;
  } catch (err) {
    console.warn('⚠️ Redis connection failed, falling back to in-memory presence tracking.');
    isRedisDisabled = true;
    if (redisClient !== null) {
      try {
        await redisClient.disconnect();
      } catch {
        // Safe ignore
      }
      redisClient = null;
    }
    return null;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient !== null && redisClient.isOpen) {
    try {
      await redisClient.quit();
    } catch {
      // Safe ignore
    }
  }
};
