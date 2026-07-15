export type PairingCodeResponse = {
  code: string;
  expiresAt: string;
};

export type PrivateChatResponse = {
  id: string;
  participantIds: [string, string];
  friendshipId: string;
  createdAt: string;
};

export type FriendshipResponse = {
  id: string;
  participantIds: [string, string];
  chatId: string;
  createdAt: string;
};

export type PairingCompletedResponse = {
  friendship: FriendshipResponse;
  chat: PrivateChatResponse;
};
