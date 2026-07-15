import { type FastifyReply, type FastifyRequest } from 'fastify';

import { sendSuccess } from '../../../common/http/api-response';
import { validateBody } from '../../../common/http/validate';
import { loginSchema, refreshTokenSchema, registerSchema } from '../schemas/auth.schemas';
import * as authService from '../services/auth.service';

export const register = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const input = validateBody(request, registerSchema);
  const result = await authService.register(input);

  return sendSuccess(reply, {
    statusCode: 201,
    data: result,
    message: 'Account created',
  });
};

export const login = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const input = validateBody(request, loginSchema);
  const result = await authService.login(input);

  return sendSuccess(reply, {
    data: result,
    message: 'Logged in',
  });
};

export const refresh = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const input = validateBody(request, refreshTokenSchema);
  const result = await authService.refresh(input.refreshToken);

  return sendSuccess(reply, {
    data: result,
    message: 'Token refreshed',
  });
};

export const logout = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  await authService.logout(request.user.userId);

  return sendSuccess(reply, {
    data: {
      loggedOut: true,
    },
    message: 'Logged out',
  });
};

export const me = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const user = await authService.getProfile(request.user.userId);

  return sendSuccess(reply, {
    data: {
      user,
    },
  });
};
