import { Types } from 'mongoose';

import { AppError } from '../../../common/errors/app-error';
import { ChatModel, type ChatDocument } from '../../pairing/models/chat.model';
import { MessageModel, type MessageDocument } from '../models/message.model';
import { MediaAssetModel } from '../../media/models/media-asset.model';
import { cloudinary } from '../../../plugins/cloudinary';
import { emitMessageDeleted } from './message-emitter.service';
import {
  type CreateTextMessageInput,
  type ListMessagesQuery,
  type ReactionInput,
} from '../schemas/message.schemas';
import { type MessageReactionResponse, type MessageResponse } from '../types/message.types';

const toObjectId = (id: string, errorMessage: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: errorMessage,
    });
  }

  return new Types.ObjectId(id);
};

const getAccessibleChat = async (userId: string, chatId: string): Promise<ChatDocument> => {
  const chatObjectId = toObjectId(chatId, 'Invalid chat id');
  const userObjectId = toObjectId(userId, 'Invalid authenticated user');
  const chat = await ChatModel.findOne({
    _id: chatObjectId,
    participants: userObjectId,
  });

  if (chat === null) {
    throw new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Chat not found',
    });
  }

  return chat;
};

const getRecipientId = (chat: ChatDocument, senderId: string): Types.ObjectId => {
  const senderObjectId = toObjectId(senderId, 'Invalid authenticated user');
  const recipientId = chat.participants.find((participantId) => !participantId.equals(senderObjectId));

  if (recipientId === undefined) {
    throw new AppError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Chat recipient could not be resolved',
    });
  }

  return recipientId;
};

const ensureMessageInChat = async (messageId: string, chatId: Types.ObjectId): Promise<MessageDocument> => {
  const message = await MessageModel.findOne({
    _id: toObjectId(messageId, 'Invalid message id'),
    chatId,
    deletedAt: null,
  });

  if (message === null) {
    throw new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Message not found',
    });
  }

  return message;
};

const toReactionResponse = (reaction: { userId: Types.ObjectId; emoji: string; createdAt: Date }): MessageReactionResponse => ({
  userId: reaction.userId.toString(),
  emoji: reaction.emoji,
  createdAt: reaction.createdAt.toISOString(),
});

export const toMessageResponse = (message: MessageDocument): MessageResponse => ({
  id: message._id.toString(),
  chatId: message.chatId.toString(),
  senderId: message.senderId.toString(),
  recipientId: message.recipientId.toString(),
  clientMessageId: message.clientMessageId,
  type: message.type,
  text: message.deletedAt === null ? message.text : '',
  replyToMessageId: message.replyToMessageId?.toString() ?? null,
  reactions: message.reactions.map(toReactionResponse),
  status: message.status,
  deliveredAt: message.deliveredAt?.toISOString() ?? null,
  seenAt: message.seenAt?.toISOString() ?? null,
  deletedAt: message.deletedAt?.toISOString() ?? null,
  deleteAt: message.deleteAt?.toISOString() ?? null,
  createdAt: message.createdAt.toISOString(),
  updatedAt: message.updatedAt.toISOString(),
});

export const createTextMessage = async (
  userId: string,
  chatId: string,
  input: CreateTextMessageInput,
): Promise<MessageResponse> => {
  const chat = await getAccessibleChat(userId, chatId);
  const senderId = toObjectId(userId, 'Invalid authenticated user');
  const recipientId = getRecipientId(chat, userId);

  if (input.clientMessageId !== undefined) {
    const existingMessage = await MessageModel.findOne({
      senderId,
      clientMessageId: input.clientMessageId,
    });

    if (existingMessage !== null) {
      return toMessageResponse(existingMessage);
    }
  }

  if (input.replyToMessageId !== undefined) {
    await ensureMessageInChat(input.replyToMessageId, chat._id);
  }

  const message = await MessageModel.create({
    chatId: chat._id,
    senderId,
    recipientId,
    clientMessageId: input.clientMessageId ?? null,
    type: 'text',
    text: input.text,
    replyToMessageId: input.replyToMessageId === undefined ? null : toObjectId(input.replyToMessageId, 'Invalid reply message id'),
    status: 'sent',
  });

  return toMessageResponse(message);
};

export const listMessages = async (
  userId: string,
  chatId: string,
  query: ListMessagesQuery,
): Promise<MessageResponse[]> => {
  const chat = await getAccessibleChat(userId, chatId);
  const filters: {
    chatId: Types.ObjectId;
    deletedAt: null;
    createdAt?: { $lt: Date };
  } = {
    chatId: chat._id,
    deletedAt: null,
  };

  if (query.before !== undefined) {
    filters.createdAt = { $lt: new Date(query.before) };
  }

  const messages = await MessageModel.find(filters).sort({ createdAt: -1 }).limit(query.limit);

  return messages.reverse().map(toMessageResponse);
};

export const markDelivered = async (userId: string, messageId: string): Promise<MessageResponse> => {
  const userObjectId = toObjectId(userId, 'Invalid authenticated user');
  const message = await MessageModel.findOne({
    _id: toObjectId(messageId, 'Invalid message id'),
    recipientId: userObjectId,
    deletedAt: null,
  });

  if (message === null) {
    throw new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Message not found',
    });
  }

  if (message.deliveredAt === null) {
    message.deliveredAt = new Date();
  }

  if (message.status === 'sent') {
    message.status = 'delivered';
  }

  await message.save();
  return toMessageResponse(message);
};

export const markSeen = async (userId: string, messageId: string): Promise<MessageResponse> => {
  const userObjectId = toObjectId(userId, 'Invalid authenticated user');
  const message = await MessageModel.findOne({
    _id: toObjectId(messageId, 'Invalid message id'),
    recipientId: userObjectId,
    deletedAt: null,
  });

  if (message === null) {
    throw new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Message not found',
    });
  }

  const now = new Date();

  if (message.deliveredAt === null) {
    message.deliveredAt = now;
  }

  if (message.seenAt === null) {
    message.seenAt = now;
    // Set deleteAt to seenAt + 10 minutes (10 * 60 * 1000 milliseconds)
    message.deleteAt = new Date(now.getTime() + 10 * 60 * 1000);
  }

  message.status = 'seen';
  await message.save();

  return toMessageResponse(message);
};

export const setReaction = async (
  userId: string,
  messageId: string,
  input: ReactionInput,
): Promise<MessageResponse> => {
  const userObjectId = toObjectId(userId, 'Invalid authenticated user');
  const message = await MessageModel.findOne({
    _id: toObjectId(messageId, 'Invalid message id'),
    deletedAt: null,
  });

  if (message === null) {
    throw new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Message not found',
    });
  }

  await getAccessibleChat(userId, message.chatId.toString());

  message.reactions = message.reactions.filter((reaction) => !reaction.userId.equals(userObjectId));
  message.reactions.push({
    userId: userObjectId,
    emoji: input.emoji,
    createdAt: new Date(),
  });
  await message.save();

  return toMessageResponse(message);
};

export const removeReaction = async (userId: string, messageId: string): Promise<MessageResponse> => {
  const userObjectId = toObjectId(userId, 'Invalid authenticated user');
  const message = await MessageModel.findOne({
    _id: toObjectId(messageId, 'Invalid message id'),
    deletedAt: null,
  });

  if (message === null) {
    throw new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Message not found',
    });
  }

  await getAccessibleChat(userId, message.chatId.toString());
  message.reactions = message.reactions.filter((reaction) => !reaction.userId.equals(userObjectId));
  await message.save();

  return toMessageResponse(message);
};

// Disappearing Media Deletion Helpers
const deleteMessageAttachment = async (text: string): Promise<void> => {
  const match = /^\[media:(image|voice):(https?:\/\/[^\]]+)\]$/i.exec(text.trim());
  if (match !== null) {
    const secureUrl = match[2];
    const asset = await MediaAssetModel.findOne({ secureUrl, deletedAt: null } as any) as any;
    if (asset !== null) {
      try {
        await cloudinary.uploader.destroy(asset.publicId, {
          resource_type: asset.resourceType,
          type: 'authenticated',
          invalidate: true,
        });
        asset.deletedAt = new Date();
        await asset.save();
      } catch (err) {
        console.error('Failed to destroy Cloudinary asset:', err);
      }
    }
  }
};

const cascadeDeleteMessage = async (messageId: Types.ObjectId): Promise<void> => {
  const replies = await MessageModel.find({ replyToMessageId: messageId, deletedAt: null });
  for (const reply of replies) {
    await performFullDeletion(reply);
  }
};

export const performFullDeletion = async (message: MessageDocument): Promise<void> => {
  // 1. Mark as soft deleted in MongoDB
  message.deletedAt = new Date();
  await message.save();

  // 2. Destroy asset from Cloudinary
  await deleteMessageAttachment(message.text);

  // 3. Emit deleted realtime socket event
  emitMessageDeleted(toMessageResponse(message));

  // 4. Cascade delete any child replies pointing to this message
  await cascadeDeleteMessage(message._id);
};

export const deleteMessage = async (userId: string, messageId: string): Promise<MessageResponse> => {
  const userObjectId = toObjectId(userId, 'Invalid authenticated user');
  const message = await MessageModel.findOne({
    _id: toObjectId(messageId, 'Invalid message id'),
    senderId: userObjectId,
    deletedAt: null,
  });

  if (message === null) {
    throw new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Message not found',
    });
  }

  await performFullDeletion(message);

  return toMessageResponse(message);
};

// Background Interval Cleanup Manager
let cleanupInterval: NodeJS.Timeout | null = null;

export const startDisappearingMessagesCleanup = (): void => {
  if (cleanupInterval !== null) {
    return;
  }
  cleanupInterval = setInterval(async () => {
    try {
      const now = new Date();
      const messagesToDelete = await MessageModel.find({
        deleteAt: { $ne: null, $lte: now },
        deletedAt: null,
      });

      for (const message of messagesToDelete) {
        await performFullDeletion(message);
      }
    } catch (err) {
      console.error('Disappearing messages background cleanup task error:', err);
    }
  }, 3000);
};

export const stopDisappearingMessagesCleanup = (): void => {
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};
