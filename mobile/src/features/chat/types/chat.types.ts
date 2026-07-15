export type PartnerDetails = {
  id: string;
  email: string;
  online: boolean;
  lastSeenAt: string | null;
};

export type MessageStatus = 'sent' | 'delivered' | 'seen';

export type MessageReactionResponse = {
  userId: string;
  emoji: string;
  createdAt: string;
};

export type Message = {
  id: string;
  chatId: string;
  senderId: string;
  recipientId: string;
  clientMessageId: string | null;
  type: 'text';
  text: string;
  replyToMessageId: string | null;
  reactions: MessageReactionResponse[];
  status: MessageStatus;
  deliveredAt: string | null;
  seenAt: string | null;
  deletedAt: string | null;
  deleteAt?: string | null;
  createdAt: string;
  updatedAt: string;
  // Local parser helpers
  mediaKind?: 'image' | 'voice';
  mediaUrl?: string;
  isOptimistic?: boolean;
  hasSendingFailed?: boolean;
  localMediaUri?: string;
};
