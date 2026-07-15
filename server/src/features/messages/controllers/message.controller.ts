import { type FastifyReply, type FastifyRequest } from 'fastify';

import { sendSuccess } from '../../../common/http/api-response';
import { validateBody, validateParams, validateQuery } from '../../../common/http/validate';
import {
  chatParamsSchema,
  createTextMessageSchema,
  listMessagesQuerySchema,
  messageParamsSchema,
  reactionSchema,
} from '../schemas/message.schemas';
import {
  emitMessageCreated,
  emitMessageDeleted,
  emitMessageDelivered,
  emitMessageReaction,
  emitMessageReply,
  emitMessageSeen,
} from '../services/message-emitter.service';
import * as messageService from '../services/message.service';

export const createTextMessage = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const params = validateParams(request, chatParamsSchema);
  const input = validateBody(request, createTextMessageSchema);
  const message = await messageService.createTextMessage(request.user.userId, params.chatId, input);

  if (message.replyToMessageId === null) {
    emitMessageCreated(message);
  } else {
    emitMessageReply(message);
  }

  return sendSuccess(reply, {
    statusCode: 201,
    data: {
      message,
    },
    message: 'Message sent',
  });
};

export const listMessages = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const params = validateParams(request, chatParamsSchema);
  const query = validateQuery(request, listMessagesQuerySchema);
  const messages = await messageService.listMessages(request.user.userId, params.chatId, query);

  return sendSuccess(reply, {
    data: {
      messages,
    },
  });
};

export const markDelivered = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const params = validateParams(request, messageParamsSchema);
  const message = await messageService.markDelivered(request.user.userId, params.messageId);
  emitMessageDelivered(message);

  return sendSuccess(reply, {
    data: {
      message,
    },
    message: 'Message delivered',
  });
};

export const markSeen = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const params = validateParams(request, messageParamsSchema);
  const message = await messageService.markSeen(request.user.userId, params.messageId);
  emitMessageSeen(message);

  return sendSuccess(reply, {
    data: {
      message,
    },
    message: 'Message seen',
  });
};

export const setReaction = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const params = validateParams(request, messageParamsSchema);
  const input = validateBody(request, reactionSchema);
  const message = await messageService.setReaction(request.user.userId, params.messageId, input);
  emitMessageReaction(message);

  return sendSuccess(reply, {
    data: {
      message,
    },
    message: 'Reaction updated',
  });
};

export const removeReaction = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const params = validateParams(request, messageParamsSchema);
  const message = await messageService.removeReaction(request.user.userId, params.messageId);
  emitMessageReaction(message);

  return sendSuccess(reply, {
    data: {
      message,
    },
    message: 'Reaction removed',
  });
};

export const deleteMessage = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const params = validateParams(request, messageParamsSchema);
  const message = await messageService.deleteMessage(request.user.userId, params.messageId);
  emitMessageDeleted(message);

  return sendSuccess(reply, {
    data: {
      message,
    },
    message: 'Message deleted',
  });
};
