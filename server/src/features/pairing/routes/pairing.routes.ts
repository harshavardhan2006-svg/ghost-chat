import { type FastifyInstance } from 'fastify';

import { authenticate } from '../../../middleware/auth.middleware';
import * as pairingController from '../controllers/pairing.controller';

export const registerPairingRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post('/code', { preHandler: authenticate }, pairingController.generateCode);
  app.post('/pair', { preHandler: authenticate }, pairingController.pairWithCode);
  app.get('/status', { preHandler: authenticate }, pairingController.getStatus);
  app.get('/partner', { preHandler: authenticate }, pairingController.getPartnerDetails);
  app.post('/unpair', { preHandler: authenticate }, pairingController.unpair);
};
