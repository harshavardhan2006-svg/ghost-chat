export const mediaKinds = ['image', 'voice'] as const;
export type MediaKind = (typeof mediaKinds)[number];

export type MediaResourceType = 'image' | 'video' | 'raw';

export type MediaAssetResponse = {
  id: string;
  ownerId: string;
  kind: MediaKind;
  publicId: string;
  secureUrl: string;
  resourceType: MediaResourceType;
  format: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SignedUploadResponse = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: MediaResourceType;
  allowedFormats: string[];
  maxFileSizeBytes: number;
};
