import { z } from 'zod';

export const chatEventSchema = z.object({
  chatId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid chat id'),
});

export const messageEventSchema = chatEventSchema.extend({
  messageId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid message id'),
});

export const reactionEventSchema = messageEventSchema.extend({
  reaction: z.string().trim().min(1).max(32),
});

export const replyEventSchema = chatEventSchema.extend({
  text: z.string().trim().min(1).max(5000),
  clientMessageId: z.string().trim().min(1).max(128).optional(),
  replyToMessageId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid reply message id'),
});
