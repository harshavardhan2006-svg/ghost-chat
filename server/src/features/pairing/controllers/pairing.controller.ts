import { type FastifyReply, type FastifyRequest } from 'fastify';

import { sendSuccess } from '../../../common/http/api-response';
import { validateBody } from '../../../common/http/validate';
import { pairWithCodeSchema } from '../schemas/pairing.schemas';
import * as pairingService from '../services/pairing.service';
import { emitPairingCompleted, emitUnpaired } from '../socket/pairing.socket';

export const generateCode = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const result = await pairingService.generatePairingCode(request.user.userId);

  return sendSuccess(reply, {
    statusCode: 201,
    data: result,
    message: 'Pairing code generated',
  });
};

export const pairWithCode = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const input = validateBody(request, pairWithCodeSchema);
  const result = await pairingService.pairWithCode(request.user.userId, input.code);
  emitPairingCompleted(result);

  return sendSuccess(reply, {
    data: result,
    message: 'Pairing completed',
  });
};

export const getStatus = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const result = await pairingService.getPairingStatus(request.user.userId);

  return sendSuccess(reply, {
    data: result,
  });
};

export const getPartnerDetails = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const result = await pairingService.getPartnerDetails(request.user.userId);

  return sendSuccess(reply, {
    data: result,
  });
};

export const unpair = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const result = await pairingService.unpairUsers(request.user.userId);
  if (result.success && result.unpairedUserId !== null) {
    emitUnpaired(request.user.userId, result.unpairedUserId);
  }

  return sendSuccess(reply, {
    data: null,
    message: 'Pairing cleared successfully',
  });
};
