import { type FastifyInstance } from 'fastify';

import { authenticate } from '../../../middleware/auth.middleware';
import * as messageController from '../controllers/message.controller';

export const registerMessageRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/chats/:chatId/messages', { preHandler: authenticate }, messageController.listMessages);
  app.post('/chats/:chatId/messages', { preHandler: authenticate }, messageController.createTextMessage);
  app.patch('/messages/:messageId/delivered', { preHandler: authenticate }, messageController.markDelivered);
  app.patch('/messages/:messageId/seen', { preHandler: authenticate }, messageController.markSeen);
  app.put('/messages/:messageId/reaction', { preHandler: authenticate }, messageController.setReaction);
  app.delete('/messages/:messageId/reaction', { preHandler: authenticate }, messageController.removeReaction);
  app.delete('/messages/:messageId', { preHandler: authenticate }, messageController.deleteMessage);
};
