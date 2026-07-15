import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const chatParamsSchema = z.object({
  chatId: objectIdSchema,
});

export const messageParamsSchema = z.object({
  messageId: objectIdSchema,
});

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
});

export const createTextMessageSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  clientMessageId: z.string().trim().min(1).max(128).optional(),
  replyToMessageId: objectIdSchema.optional(),
});

export const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(32),
});

export type ChatParams = z.infer<typeof chatParamsSchema>;
export type MessageParams = z.infer<typeof messageParamsSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type CreateTextMessageInput = z.infer<typeof createTextMessageSchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
