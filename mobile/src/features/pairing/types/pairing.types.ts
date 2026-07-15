export type PairingCodeResponse = {
  code: string;
  expiresAt: string;
};

export type PairingCompletedResponse = {
  friendship: {
    id: string;
    participantIds: string[];
    chatId: string;
    createdAt: string;
  };
  chat: {
    id: string;
    participantIds: string[];
    friendshipId: string;
    createdAt: string;
  };
};

export type PairingStatusResponse = {
  paired: boolean;
  partnerId: string | null;
  chatId: string | null;
};
