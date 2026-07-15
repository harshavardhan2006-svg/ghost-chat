import { Types } from 'mongoose';

import { ChatModel } from '../../pairing/models/chat.model';

export const chatRoom = (chatId: string): string => `chat:${chatId}`;

export const userRoom = (userId: string): string => `user:${userId}`;

export const canAccessChat = async (userId: string, chatId: string): Promise<boolean> => {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(chatId)) {
    return false;
  }

  const chat = await ChatModel.exists({
    _id: new Types.ObjectId(chatId),
    participants: new Types.ObjectId(userId),
  });

  return chat !== null;
};
