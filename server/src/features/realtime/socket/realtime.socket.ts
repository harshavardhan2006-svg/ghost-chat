import { type Server, type Socket } from 'socket.io';
import { ZodError, type z } from 'zod';

import { AppError } from '../../../common/errors/app-error';
import { socketEvents } from '../../../socket/events';
import {
  emitMessageDeleted,
  emitMessageReaction,
  emitMessageReply,
  emitMessageSeen,
} from '../../messages/services/message-emitter.service';
import * as messageService from '../../messages/services/message.service';
import {
  chatEventSchema,
  messageEventSchema,
  reactionEventSchema,
  replyEventSchema,
} from '../schemas/realtime.schemas';
import { addSocketPresence, refreshSocketPresence, removeSocketPresence } from '../services/presence.service';
import { canAccessChat, chatRoom, userRoom } from '../services/room.service';
import { type SocketAuthPayload } from '../types/realtime.types';

const validateSocketPayload = <TSchema extends z.ZodType>(socket: Socket, schema: TSchema, payload: unknown): z.infer<TSchema> | null => {
  try {
    return schema.parse(payload);
  } catch (error) {
    const message = error instanceof ZodError ? error.issues[0]?.message ?? 'Invalid socket payload' : 'Invalid socket payload';
    socket.emit(socketEvents.socketError, { message });
    return null;
  }
};

const runSocketHandler = (socket: Socket, handler: () => Promise<void>): void => {
  void handler().catch((error: unknown) => {
    const message = error instanceof AppError || error instanceof Error ? error.message : 'Socket event failed';
    socket.emit(socketEvents.socketError, { message });
  });
};

const emitToChatIfAllowed = async (
  socket: Socket,
  user: SocketAuthPayload,
  event: string,
  payload: { chatId: string },
): Promise<void> => {
  const allowed = await canAccessChat(user.userId, payload.chatId);

  if (!allowed) {
    socket.emit(socketEvents.socketError, { message: 'You do not have access to this chat' });
    return;
  }

  await refreshSocketPresence(user.userId);
  socket.to(chatRoom(payload.chatId)).emit(event, {
    ...payload,
    userId: user.userId,
    emittedAt: new Date().toISOString(),
  });
};

export const registerRealtimeSocketEvents = async (io: Server, socket: Socket, user: SocketAuthPayload): Promise<void> => {
  socket.join(userRoom(user.userId));
  const onlinePayload = await addSocketPresence(user.userId, socket.id);
  io.emit(socketEvents.online, onlinePayload);

  socket.conn.on('packet', () => {
    void refreshSocketPresence(user.userId);
  });

  socket.on(socketEvents.joinChat, (payload: unknown) => {
    runSocketHandler(socket, async () => {
    const input = validateSocketPayload(socket, chatEventSchema, payload);

    if (input === null) {
      return;
    }

    const allowed = await canAccessChat(user.userId, input.chatId);

    if (!allowed) {
      socket.emit(socketEvents.socketError, { message: 'You do not have access to this chat' });
      return;
    }

    await refreshSocketPresence(user.userId);
    await socket.join(chatRoom(input.chatId));
    });
  });

  socket.on(socketEvents.leaveChat, (payload: unknown) => {
    runSocketHandler(socket, async () => {
    const input = validateSocketPayload(socket, chatEventSchema, payload);

    if (input === null) {
      return;
    }

    await refreshSocketPresence(user.userId);
    await socket.leave(chatRoom(input.chatId));
    });
  });

  socket.on(socketEvents.typing, (payload: unknown) => {
    runSocketHandler(socket, async () => {
    const input = validateSocketPayload(socket, chatEventSchema, payload);

    if (input !== null) {
      await emitToChatIfAllowed(socket, user, socketEvents.typing, input);
    }
    });
  });

  socket.on(socketEvents.stopTyping, (payload: unknown) => {
    runSocketHandler(socket, async () => {
    const input = validateSocketPayload(socket, chatEventSchema, payload);

    if (input !== null) {
      await emitToChatIfAllowed(socket, user, socketEvents.stopTyping, input);
    }
    });
  });

  socket.on(socketEvents.seen, (payload: unknown) => {
    runSocketHandler(socket, async () => {
    const input = validateSocketPayload(socket, messageEventSchema, payload);

    if (input !== null) {
      const message = await messageService.markSeen(user.userId, input.messageId);
      emitMessageSeen(message);
    }
    });
  });

  socket.on(socketEvents.reaction, (payload: unknown) => {
    runSocketHandler(socket, async () => {
    const input = validateSocketPayload(socket, reactionEventSchema, payload);

    if (input !== null) {
      const message = await messageService.setReaction(user.userId, input.messageId, { emoji: input.reaction });
      emitMessageReaction(message);
    }
    });
  });

  socket.on(socketEvents.reply, (payload: unknown) => {
    runSocketHandler(socket, async () => {
    const input = validateSocketPayload(socket, replyEventSchema, payload);

    if (input !== null) {
      const message = await messageService.createTextMessage(user.userId, input.chatId, {
        text: input.text,
        clientMessageId: input.clientMessageId,
        replyToMessageId: input.replyToMessageId,
      });
      emitMessageReply(message);
    }
    });
  });

  socket.on(socketEvents.deleteMessage, (payload: unknown) => {
    runSocketHandler(socket, async () => {
    const input = validateSocketPayload(socket, messageEventSchema, payload);

    if (input !== null) {
      const message = await messageService.deleteMessage(user.userId, input.messageId);
      emitMessageDeleted(message);
    }
    });
  });

  socket.on(socketEvents.disconnect, () => {
    runSocketHandler(socket, async () => {
    const presencePayload = await removeSocketPresence(user.userId, socket.id);

    if (!presencePayload.online) {
      io.emit(socketEvents.offline, presencePayload);
    }
    });
  });
};
