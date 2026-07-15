import { Readable } from 'node:stream';

import { type MultipartFile } from '@fastify/multipart';
import { Types } from 'mongoose';

import { AppError } from '../../../common/errors/app-error';
import { env } from '../../../config/env';
import { cloudinary } from '../../../plugins/cloudinary';
import { MediaAssetModel, type MediaAssetDocument } from '../models/media-asset.model';
import {
  type MediaAssetResponse,
  type MediaKind,
  type MediaResourceType,
  type SignedUploadResponse,
} from '../types/media.types';

type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  resource_type: MediaResourceType;
  format?: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
};

type CloudinaryDestroyResult = {
  result?: string;
};

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const voiceMimeTypes = new Set(['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/x-m4a']);
const imageFormats = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const voiceFormats = ['mp3', 'm4a', 'aac', 'wav', 'webm', 'ogg'];

const toObjectId = (id: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Invalid id',
    });
  }

  return new Types.ObjectId(id);
};

const getKindConfig = (
  kind: MediaKind,
): {
  folder: string;
  resourceType: MediaResourceType;
  maxFileSizeBytes: number;
  allowedMimeTypes: Set<string>;
  allowedFormats: string[];
} => {
  if (kind === 'image') {
    return {
      folder: `${env.CLOUDINARY_MEDIA_FOLDER}/images`,
      resourceType: 'image',
      maxFileSizeBytes: env.MAX_IMAGE_FILE_SIZE_BYTES,
      allowedMimeTypes: imageMimeTypes,
      allowedFormats: imageFormats,
    };
  }

  return {
    folder: `${env.CLOUDINARY_MEDIA_FOLDER}/voice`,
    resourceType: 'video',
    maxFileSizeBytes: env.MAX_VOICE_FILE_SIZE_BYTES,
    allowedMimeTypes: voiceMimeTypes,
    allowedFormats: voiceFormats,
  };
};

const toMediaAssetResponse = (asset: MediaAssetDocument): MediaAssetResponse => ({
  id: asset._id.toString(),
  ownerId: asset.ownerId.toString(),
  kind: asset.kind,
  publicId: asset.publicId,
  secureUrl: asset.secureUrl,
  resourceType: asset.resourceType,
  format: asset.format,
  bytes: asset.bytes,
  width: asset.width,
  height: asset.height,
  duration: asset.duration,
  deletedAt: asset.deletedAt?.toISOString() ?? null,
  createdAt: asset.createdAt.toISOString(),
  updatedAt: asset.updatedAt.toISOString(),
});

const assertFileAllowed = (file: MultipartFile, kind: MediaKind): void => {
  const config = getKindConfig(kind);

  if (!config.allowedMimeTypes.has(file.mimetype)) {
    throw new AppError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: `Unsupported ${kind} file type`,
    });
  }
};

const uploadToCloudinary = async (buffer: Buffer, kind: MediaKind): Promise<CloudinaryUploadResult> => {
  const config = getKindConfig(kind);

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: config.folder,
        resource_type: config.resourceType,
        allowed_formats: config.allowedFormats,
        overwrite: false,
        invalidate: true,
        type: 'authenticated',
        transformation:
          kind === 'image'
            ? [
                {
                  quality: 'auto:good',
                  fetch_format: 'auto',
                  flags: 'strip_profile',
                },
              ]
            : [
                {
                  audio_codec: 'aac',
                  bit_rate: '96k',
                },
              ],
      },
      (error, result) => {
        if (error !== undefined) {
          reject(error);
          return;
        }

        if (result === undefined) {
          reject(new Error('Cloudinary upload returned no result'));
          return;
        }

        resolve(result as CloudinaryUploadResult);
      },
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

export const uploadMedia = async (
  ownerId: string,
  kind: MediaKind,
  file: MultipartFile | undefined,
): Promise<MediaAssetResponse> => {
  if (file === undefined) {
    throw new AppError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Media file is required',
    });
  }

  assertFileAllowed(file, kind);

  const config = getKindConfig(kind);
  const buffer = await file.toBuffer();

  if (buffer.byteLength > config.maxFileSizeBytes) {
    throw new AppError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: `${kind} file exceeds the maximum allowed size`,
    });
  }

  const result = await uploadToCloudinary(buffer, kind);
  const asset = await MediaAssetModel.create({
    ownerId: toObjectId(ownerId),
    kind,
    publicId: result.public_id,
    secureUrl: result.secure_url,
    resourceType: result.resource_type,
    format: result.format ?? null,
    bytes: result.bytes,
    width: result.width ?? null,
    height: result.height ?? null,
    duration: result.duration ?? null,
  });

  return toMediaAssetResponse(asset);
};

export const createSignedUpload = (kind: MediaKind): SignedUploadResponse => {
  const config = getKindConfig(kind);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    {
      folder: config.folder,
      timestamp,
      type: 'authenticated',
    },
    env.CLOUDINARY_API_SECRET,
  );

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder: config.folder,
    resourceType: config.resourceType,
    allowedFormats: config.allowedFormats,
    maxFileSizeBytes: config.maxFileSizeBytes,
  };
};

export const deleteMedia = async (ownerId: string, mediaId: string): Promise<MediaAssetResponse> => {
  const asset = await MediaAssetModel.findOne({
    _id: toObjectId(mediaId),
    ownerId: toObjectId(ownerId),
    deletedAt: null,
  });

  if (asset === null) {
    throw new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Media asset not found',
    });
  }

  const result = (await cloudinary.uploader.destroy(asset.publicId, {
    resource_type: asset.resourceType,
    type: 'authenticated',
    invalidate: true,
  })) as CloudinaryDestroyResult;

  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new AppError({
      statusCode: 502,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Cloudinary asset deletion failed',
      details: result,
    });
  }

  asset.deletedAt = new Date();
  await asset.save();

  return toMediaAssetResponse(asset);
};
