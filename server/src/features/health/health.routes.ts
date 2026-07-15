import { type FastifyInstance } from 'fastify';

import { sendSuccess } from '../../common/http/api-response';

type HealthResponse = {
  service: 'ghost-api';
  status: 'ok';
  timestamp: string;
};

export const registerHealthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/health', async (_request, reply) => {
    const payload: HealthResponse = {
      service: 'ghost-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    return sendSuccess(reply, { data: payload });
  });
};
