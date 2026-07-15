import { getRedisClient } from '../../../database/redis';
import { env } from '../../../config/env';
import { UserModel } from '../../auth/models/user.model';
import { type PresencePayload } from '../types/realtime.types';

const presenceKey = (userId: string): string => `presence:user:${userId}`;
const socketsKey = (userId: string): string => `presence:user:${userId}:sockets`;
const lastSeenKey = (userId: string): string => `presence:user:${userId}:last-seen`;

// Memory fallback storage for presence when Redis is not configured
type MemoryPresenceRecord = {
  sockets: Set<string>;
  online: boolean;
  lastSeenAt: string;
};
const memoryPresence = new Map<string, MemoryPresenceRecord>();

export const addSocketPresence = async (userId: string, socketId: string): Promise<PresencePayload> => {
  const redis = getRedisClient();
  const now = new Date().toISOString();

  if (redis === null) {
    let record = memoryPresence.get(userId);
    if (record === undefined) {
      record = { sockets: new Set(), online: true, lastSeenAt: now };
      memoryPresence.set(userId, record);
    }
    record.sockets.add(socketId);
    record.online = true;
    record.lastSeenAt = now;

    return {
      userId,
      online: true,
      lastSeenAt: now,
    };
  }

  await redis.sAdd(socketsKey(userId), socketId);
  await redis.expire(socketsKey(userId), env.SOCKET_PRESENCE_TTL_SECONDS);
  await redis.set(presenceKey(userId), 'online', { EX: env.SOCKET_PRESENCE_TTL_SECONDS });
  await redis.set(lastSeenKey(userId), now);

  return {
    userId,
    online: true,
    lastSeenAt: now,
  };
};

export const refreshSocketPresence = async (userId: string): Promise<void> => {
  const redis = getRedisClient();

  if (redis === null) {
    const record = memoryPresence.get(userId);
    if (record !== undefined) {
      record.online = true;
    }
    return;
  }

  await redis.expire(socketsKey(userId), env.SOCKET_PRESENCE_TTL_SECONDS);
  await redis.set(presenceKey(userId), 'online', { EX: env.SOCKET_PRESENCE_TTL_SECONDS });
};

export const removeSocketPresence = async (userId: string, socketId: string): Promise<PresencePayload> => {
  const redis = getRedisClient();
  const now = new Date().toISOString();

  if (redis === null) {
    const record = memoryPresence.get(userId);
    if (record !== undefined) {
      record.sockets.delete(socketId);
      if (record.sockets.size === 0) {
        record.online = false;
        record.lastSeenAt = now;
        await UserModel.findByIdAndUpdate(userId, { $set: { lastSeenAt: new Date(now) } });

        return {
          userId,
          online: false,
          lastSeenAt: now,
        };
      }
    }

    return {
      userId,
      online: true,
      lastSeenAt: now,
    };
  }

  await redis.sRem(socketsKey(userId), socketId);
  const activeSocketCount = await redis.sCard(socketsKey(userId));

  if (activeSocketCount > 0) {
    await refreshSocketPresence(userId);

    return {
      userId,
      online: true,
      lastSeenAt: now,
    };
  }

  await redis.del(presenceKey(userId));
  await redis.del(socketsKey(userId));
  await redis.set(lastSeenKey(userId), now);
  await UserModel.findByIdAndUpdate(userId, { $set: { lastSeenAt: new Date(now) } });

  return {
    userId,
    online: false,
    lastSeenAt: now,
  };
};

export const getPresence = async (userId: string): Promise<PresencePayload> => {
  const redis = getRedisClient();

  if (redis === null) {
    const record = memoryPresence.get(userId);
    if (record !== undefined) {
      return {
        userId,
        online: record.online,
        lastSeenAt: record.lastSeenAt,
      };
    }

    const user = await UserModel.findById(userId).select('lastSeenAt');

    return {
      userId,
      online: false,
      lastSeenAt: user?.lastSeenAt?.toISOString() ?? null,
    };
  }

  const [onlineValue, redisLastSeen] = await Promise.all([redis.get(presenceKey(userId)), redis.get(lastSeenKey(userId))]);

  if (redisLastSeen !== null) {
    return {
      userId,
      online: onlineValue === 'online',
      lastSeenAt: redisLastSeen,
    };
  }

  const user = await UserModel.findById(userId).select('lastSeenAt');

  return {
    userId,
    online: onlineValue === 'online',
    lastSeenAt: user?.lastSeenAt?.toISOString() ?? null,
  };
};
