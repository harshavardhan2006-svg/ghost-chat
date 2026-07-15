import { type FastifyInstance } from 'fastify';

import { authenticate } from '../../../middleware/auth.middleware';
import * as authController from '../controllers/auth.controller';

export const registerAuthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post('/register', authController.register);
  app.post('/login', authController.login);
  app.post('/refresh-token', authController.refresh);
  app.post('/logout', { preHandler: authenticate }, authController.logout);
  app.get('/me', { preHandler: authenticate }, authController.me);
};
