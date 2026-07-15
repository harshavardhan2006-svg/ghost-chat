import { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import { sendError } from '../http/api-response';
import { AppError } from './app-error';

const getStatusCode = (error: FastifyError): number => {
  if (typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  return 500;
};

export const registerErrorHandler = (app: FastifyInstance): void => {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply): void => {
    if (error instanceof AppError) {
      request.log.warn({ error }, error.message);
      sendError(reply, {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return;
    }

    if (error instanceof ZodError) {
      request.log.warn({ error }, 'Request validation failed');
      sendError(reply, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.flatten(),
      });
      return;
    }

    const statusCode = getStatusCode(error);
    const isServerError = statusCode >= 500;

    if (isServerError) {
      request.log.error({ error }, 'Unhandled server error');
    } else {
      request.log.warn({ error }, error.message);
    }

    sendError(reply, {
      statusCode,
      code: isServerError ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST',
      message: isServerError ? 'Internal server error' : error.message,
    });
  });
};
