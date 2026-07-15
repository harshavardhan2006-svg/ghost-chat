import { io, Socket } from 'socket.io-client';
import { apiConfig } from '../api/config';

let socket: Socket | null = null;
let activeToken: string | null = null;

export const getSocket = (): Socket | null => socket;

export const connectSocket = (accessToken: string): Socket => {
  if (socket?.connected && activeToken === accessToken) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  activeToken = accessToken;
  const socketUrl = apiConfig.baseUrl.replace(/\/api\/v1\/?$/, '');

  socket = io(socketUrl, {
    auth: {
      token: accessToken,
    },
    autoConnect: false,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.connect();

  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
    activeToken = null;
  }
};
