import { type FastifyInstance } from 'fastify';

import { authenticate } from '../../../middleware/auth.middleware';
import * as mediaController from '../controllers/media.controller';

export const registerMediaRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post('/upload/image', { preHandler: authenticate }, mediaController.uploadImage);
  app.post('/upload/voice', { preHandler: authenticate }, mediaController.uploadVoice);
  app.post('/signed-upload', { preHandler: authenticate }, mediaController.createSignedUpload);
  app.delete('/:mediaId', { preHandler: authenticate }, mediaController.deleteMedia);
};
