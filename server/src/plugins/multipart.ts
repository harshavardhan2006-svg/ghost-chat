import multipart from '@fastify/multipart';
import { type FastifyInstance } from 'fastify';

import { env } from '../config/env';

export const registerMultipartPlugin = async (app: FastifyInstance): Promise<void> => {
  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE_BYTES,
      files: 1,
    },
  });
};
