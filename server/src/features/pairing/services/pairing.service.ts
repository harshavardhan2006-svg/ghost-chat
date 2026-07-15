import mongoose, { ClientSession, Types } from 'mongoose';

import { AppError } from '../../../common/errors/app-error';
import { env } from '../../../config/env';
import { UserModel, type UserDocument } from '../../auth/models/user.model';
import { addMinutes } from '../../../utils/date';
import { createHmacHash, createSecureNumericCode } from '../../../utils/crypto';
import { ChatModel, type ChatDocument } from '../models/chat.model';
import { FriendshipModel, type FriendshipDocument } from '../models/friendship.model';
import { PairingCodeModel } from '../models/pairing-code.model';
import { getPresence } from '../../realtime/services/presence.service';
import {
  type FriendshipResponse,
  type PairingCodeResponse,
  type PairingCompletedResponse,
  type PrivateChatResponse,
} from '../types/pairing.types';

const MAX_CODE_GENERATION_ATTEMPTS = 5;

const createCodeHash = (code: string): string => createHmacHash(code, env.JWT_SECRET);

const ensureObjectId = (id: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid authenticated user',
    });
  }

  return new Types.ObjectId(id);
};

const createParticipantKey = (firstUserId: Types.ObjectId, secondUserId: Types.ObjectId): string =>
  [firstUserId.toString(), secondUserId.toString()].sort().join(':');

const assertUserCanPair = (user: UserDocument, message: string): void => {
  if (user.pairing.partnerId !== null || user.pairing.chatId !== null) {
    throw new AppError({
      statusCode: 409,
      code: 'CONFLICT',
      message,
    });
  }
};

const toPrivateChatResponse = (chat: ChatDocument, friendshipId: Types.ObjectId): PrivateChatResponse => ({
  id: chat._id.toString(),
  participantIds: [chat.participants[0].toString(), chat.participants[1].toString()],
  friendshipId: friendshipId.toString(),
  createdAt: chat.createdAt.toISOString(),
});

const toFriendshipResponse = (friendship: FriendshipDocument, chatId: Types.ObjectId): FriendshipResponse => ({
  id: friendship._id.toString(),
  participantIds: [friendship.participants[0].toString(), friendship.participants[1].toString()],
  chatId: chatId.toString(),
  createdAt: friendship.createdAt.toISOString(),
});

export const generatePairingCode = async (userId: string): Promise<PairingCodeResponse> => {
  const ownerId = ensureObjectId(userId);
  const user = await UserModel.findById(ownerId);

  if (user === null) {
    throw new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'User not found',
    });
  }

  assertUserCanPair(user, 'You are already paired');

  await PairingCodeModel.deleteMany({
    ownerId,
    usedAt: null,
  });

  const expiresAt = addMinutes(new Date(), env.PAIRING_CODE_TTL_MINUTES);

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const code = createSecureNumericCode(env.PAIRING_CODE_LENGTH);
    const codeHash = createCodeHash(code);
    const existingCode = await PairingCodeModel.exists({ codeHash });

    if (existingCode === null) {
      await PairingCodeModel.create({
        ownerId,
        codeHash,
        expiresAt,
      });

      return {
        code,
        expiresAt: expiresAt.toISOString(),
      };
    }
  }

  throw new AppError({
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unable to generate pairing code',
  });
};

const createPairingRecords = async (
  owner: UserDocument,
  requester: UserDocument,
  session: ClientSession,
): Promise<PairingCompletedResponse> => {
  const ownerId = owner._id;
  const requesterId = requester._id;
  const participants: [Types.ObjectId, Types.ObjectId] = [ownerId, requesterId];
  const participantKey = createParticipantKey(ownerId, requesterId);

  const existingFriendship = await FriendshipModel.findOne({ participantKey }).session(session);

  if (existingFriendship !== null) {
    throw new AppError({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'These users are already paired',
    });
  }

  const [chat] = await ChatModel.create([{ participants, friendshipId: null }], { session });
  if (chat === undefined) {
    throw new AppError({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unable to create private chat',
    });
  }

  const [friendship] = await FriendshipModel.create(
    [
      {
        participants,
        participantKey,
        chatId: chat._id,
      },
    ],
    { session },
  );
  if (friendship === undefined) {
    throw new AppError({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unable to create friendship',
    });
  }

  chat.friendshipId = friendship._id;
  await chat.save({ session });

  await UserModel.updateOne(
    { _id: ownerId },
    {
      $set: {
        'pairing.partnerId': requesterId,
        'pairing.chatId': chat._id,
      },
    },
    { session },
  );
  await UserModel.updateOne(
    { _id: requesterId },
    {
      $set: {
        'pairing.partnerId': ownerId,
        'pairing.chatId': chat._id,
      },
    },
    { session },
  );

  return {
    friendship: toFriendshipResponse(friendship, chat._id),
    chat: toPrivateChatResponse(chat, friendship._id),
  };
};

export const pairWithCode = async (userId: string, code: string): Promise<PairingCompletedResponse> => {
  const requesterId = ensureObjectId(userId);
  const codeHash = createCodeHash(code);
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const now = new Date();
      const pairingCode = await PairingCodeModel.findOne({
        codeHash,
        usedAt: null,
        expiresAt: { $gt: now },
      })
        .select('+codeHash')
        .session(session);

      if (pairingCode === null) {
        throw new AppError({
          statusCode: 400,
          code: 'BAD_REQUEST',
          message: 'Invalid or expired pairing code',
        });
      }

      if (pairingCode.ownerId.equals(requesterId)) {
        throw new AppError({
          statusCode: 400,
          code: 'BAD_REQUEST',
          message: 'You cannot pair with your own code',
        });
      }

      const [owner, requester] = await Promise.all([
        UserModel.findById(pairingCode.ownerId).session(session),
        UserModel.findById(requesterId).session(session),
      ]);

      if (owner === null || requester === null) {
        throw new AppError({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      assertUserCanPair(owner, 'Pairing code owner is already paired');
      assertUserCanPair(requester, 'You are already paired');

      const result = await createPairingRecords(owner, requester, session);

      pairingCode.usedAt = now;
      await pairingCode.save({ session });
      await PairingCodeModel.deleteMany({ ownerId: pairingCode.ownerId, usedAt: null }).session(session);

      return result;
    });
  } finally {
    await session.endSession();
  }
};

export const getPairingStatus = async (userId: string): Promise<{ paired: boolean; partnerId: string | null; chatId: string | null }> => {
  const requesterId = ensureObjectId(userId);
  const user = await UserModel.findById(requesterId);

  if (user === null) {
    throw new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'User not found',
    });
  }

  const partnerId = user.pairing.partnerId?.toString() ?? null;
  const chatId = user.pairing.chatId?.toString() ?? null;

  return {
    paired: partnerId !== null && chatId !== null,
    partnerId,
    chatId,
  };
};

export const getPartnerDetails = async (
  userId: string,
): Promise<{ id: string; email: string; online: boolean; lastSeenAt: string | null } | null> => {
  const requesterId = ensureObjectId(userId);
  const user = await UserModel.findById(requesterId);

  if (user === null || user.pairing.partnerId === null) {
    return null;
  }

  const partner = await UserModel.findById(user.pairing.partnerId);

  if (partner === null) {
    return null;
  }

  const presence = await getPresence(partner._id.toString());

  return {
    id: partner._id.toString(),
    email: partner.email,
    online: presence.online,
    lastSeenAt: presence.lastSeenAt,
  };
};
