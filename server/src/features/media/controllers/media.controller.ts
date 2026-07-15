import { type FastifyReply, type FastifyRequest } from 'fastify';

import { sendSuccess } from '../../../common/http/api-response';
import { validateBody, validateParams } from '../../../common/http/validate';
import { mediaParamsSchema, signedUploadSchema } from '../schemas/media.schemas';
import * as mediaService from '../services/media.service';

export const uploadImage = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const file = await request.file();
  const asset = await mediaService.uploadMedia(request.user.userId, 'image', file);

  return sendSuccess(reply, {
    statusCode: 201,
    data: { asset },
    message: 'Image uploaded',
  });
};

export const uploadVoice = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const file = await request.file();
  const asset = await mediaService.uploadMedia(request.user.userId, 'voice', file);

  return sendSuccess(reply, {
    statusCode: 201,
    data: { asset },
    message: 'Voice uploaded',
  });
};

export const createSignedUpload = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const input = validateBody(request, signedUploadSchema);
  const signedUpload = mediaService.createSignedUpload(input.kind);

  return sendSuccess(reply, {
    data: { signedUpload },
  });
};

export const deleteMedia = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const params = validateParams(request, mediaParamsSchema);
  const asset = await mediaService.deleteMedia(request.user.userId, params.mediaId);

  return sendSuccess(reply, {
    data: { asset },
    message: 'Media deleted',
  });
};
