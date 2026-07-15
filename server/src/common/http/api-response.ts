import { type FastifyReply } from 'fastify';

import { type ErrorCode } from '../errors/app-error';

type SuccessResponse<TData> = {
  success: true;
  data: TData;
  message?: string;
};

type ErrorResponse = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

export const sendSuccess = <TData>(
  reply: FastifyReply,
  params: {
    statusCode?: number;
    data: TData;
    message?: string;
  },
): FastifyReply => {
  const response: SuccessResponse<TData> = {
    success: true,
    data: params.data,
  };

  if (params.message !== undefined) {
    response.message = params.message;
  }

  return reply.status(params.statusCode ?? 200).send(response);
};

export const sendError = (
  reply: FastifyReply,
  params: {
    statusCode: number;
    code: ErrorCode;
    message: string;
    details?: unknown;
  },
): FastifyReply => {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: params.code,
      message: params.message,
    },
  };

  if (params.details !== undefined) {
    response.error.details = params.details;
  }

  return reply.status(params.statusCode).send(response);
};
