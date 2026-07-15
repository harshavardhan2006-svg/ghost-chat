import Fastify, { type FastifyInstance, type RawServerDefault } from 'fastify';

import { env } from './config/env';
import { loggerOptions } from './config/logger';
import { registerErrorHandler } from './common/errors/error-handler';
import { registerCorsPlugin } from './plugins/cors';
import { registerJwtPlugin } from './plugins/jwt';
import { registerMultipartPlugin } from './plugins/multipart';
import { registerAuthRoutes } from './features/auth/routes/auth.routes';
import { registerHealthRoutes } from './features/health/health.routes';
import { registerMediaRoutes } from './features/media/routes/media.routes';
import { registerMessageRoutes } from './features/messages/routes/message.routes';
import { registerPairingRoutes } from './features/pairing/routes/pairing.routes';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify<RawServerDefault>({
    logger: loggerOptions,
    trustProxy: env.TRUST_PROXY,
  });

  registerErrorHandler(app);

  await registerCorsPlugin(app);
  await registerJwtPlugin(app);
  await registerMultipartPlugin(app);

  await app.register(registerAuthRoutes, { prefix: `${env.API_PREFIX}/auth` });
  await app.register(registerPairingRoutes, { prefix: `${env.API_PREFIX}/pairing` });
  await app.register(registerMessageRoutes, { prefix: env.API_PREFIX });
  await app.register(registerMediaRoutes, { prefix: `${env.API_PREFIX}/media` });
  await app.register(registerHealthRoutes, { prefix: env.API_PREFIX });

  return app;
};
