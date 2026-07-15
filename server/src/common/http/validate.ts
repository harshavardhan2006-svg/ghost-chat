import { type FastifyRequest } from 'fastify';
import { type z } from 'zod';

export const validateBody = <TSchema extends z.ZodType>(
  request: FastifyRequest,
  schema: TSchema,
): z.infer<TSchema> => schema.parse(request.body);

export const validateParams = <TSchema extends z.ZodType>(
  request: FastifyRequest,
  schema: TSchema,
): z.infer<TSchema> => schema.parse(request.params);

export const validateQuery = <TSchema extends z.ZodType>(
  request: FastifyRequest,
  schema: TSchema,
): z.infer<TSchema> => schema.parse(request.query);
