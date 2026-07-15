import { z } from 'zod';

import { mediaKinds } from '../types/media.types';

export const mediaParamsSchema = z.object({
  mediaId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid media id'),
});

export const signedUploadSchema = z.object({
  kind: z.enum(mediaKinds),
});

export type MediaParams = z.infer<typeof mediaParamsSchema>;
export type SignedUploadInput = z.infer<typeof signedUploadSchema>;
