import fastifyJwt from '@fastify/jwt';
import { type FastifyInstance } from 'fastify';

import { env } from '../config/env';

export const registerJwtPlugin = async (app: FastifyInstance): Promise<void> => {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });
};
