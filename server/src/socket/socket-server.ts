import { type Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

import { env } from '../config/env';
import { registerRealtimeSocketEvents } from '../features/realtime/socket/realtime.socket';
import { type SocketAuthPayload } from '../features/realtime/types/realtime.types';
import { socketEvents } from './events';
import { setSocketServer } from './socket-state';

const extractBearerToken = (authorization: string | undefined): string | null => {
  if (authorization === undefined) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || token === undefined || token.length === 0) {
    return null;
  }

  return token;
};

const verifySocketToken = (token: string): SocketAuthPayload | null => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);

    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
    };
  } catch {
    return null;
  }
};

export const createSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
    pingInterval: env.SOCKET_PING_INTERVAL_MS,
    pingTimeout: env.SOCKET_PING_TIMEOUT_MS,
    connectionStateRecovery: {
      maxDisconnectionDuration: env.SOCKET_PING_INTERVAL_MS + env.SOCKET_PING_TIMEOUT_MS,
      skipMiddlewares: false,
    },
  });

  setSocketServer(io);

  io.use((socket, next) => {
    const authToken = typeof socket.handshake.auth.token === 'string' ? socket.handshake.auth.token : null;
    const bearerToken = extractBearerToken(socket.handshake.headers.authorization);
    const token = authToken ?? bearerToken;

    if (token === null) {
      next(new Error('Unauthorized socket connection'));
      return;
    }

    const payload = verifySocketToken(token);

    if (payload === null) {
      next(new Error('Unauthorized socket connection'));
      return;
    }

    socket.data.user = payload;
    next();
  });

  io.on(socketEvents.connection, (socket) => {
    const user = socket.data.user as SocketAuthPayload;

    void registerRealtimeSocketEvents(io, socket, user);

    socket.on(socketEvents.disconnect, () => {
      socket.removeAllListeners();
    });
  });

  return io;
};
