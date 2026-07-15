export const messageStatuses = ['sent', 'delivered', 'seen'] as const;
export type MessageStatus = (typeof messageStatuses)[number];

export const messageTypes = ['text'] as const;
export type MessageType = (typeof messageTypes)[number];

export type MessageReactionResponse = {
  userId: string;
  emoji: string;
  createdAt: string;
};

export type MessageResponse = {
  id: string;
  chatId: string;
  senderId: string;
  recipientId: string;
  clientMessageId: string | null;
  type: MessageType;
  text: string;
  replyToMessageId: string | null;
  reactions: MessageReactionResponse[];
  status: MessageStatus;
  deliveredAt: string | null;
  seenAt: string | null;
  deletedAt: string | null;
  deleteAt: string | null;
  createdAt: string;
  updatedAt: string;
};
