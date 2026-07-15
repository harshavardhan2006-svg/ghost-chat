import cors from '@fastify/cors';
import { type FastifyInstance } from 'fastify';

import { env } from '../config/env';

export const registerCorsPlugin = async (app: FastifyInstance): Promise<void> => {
  await app.register(cors, {
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
};
