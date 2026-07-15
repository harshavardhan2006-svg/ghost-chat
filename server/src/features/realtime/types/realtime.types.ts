export type SocketAuthPayload = {
  userId: string;
  email: string;
};

export type ChatEventPayload = {
  chatId: string;
};

export type MessageEventPayload = {
  chatId: string;
  messageId: string;
};

export type ReactionEventPayload = MessageEventPayload & {
  reaction: string;
};

export type ReplyEventPayload = MessageEventPayload & {
  replyToMessageId: string;
};

export type PresencePayload = {
  userId: string;
  online: boolean;
  lastSeenAt: string | null;
};
