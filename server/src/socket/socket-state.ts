import { type Server } from 'socket.io';

let socketServer: Server | null = null;

export const setSocketServer = (server: Server): void => {
  socketServer = server;
};

export const getSocketServer = (): Server | null => socketServer;
