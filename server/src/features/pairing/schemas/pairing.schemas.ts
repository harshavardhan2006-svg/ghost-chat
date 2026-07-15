import { z } from 'zod';

export const pairWithCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Pairing code must be exactly 6 digits'),
});

export type PairWithCodeInput = z.infer<typeof pairWithCodeSchema>;
