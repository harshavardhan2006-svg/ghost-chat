import { type FastifyReply, type FastifyRequest } from 'fastify';

export const authenticate = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
  await request.jwtVerify();
};
