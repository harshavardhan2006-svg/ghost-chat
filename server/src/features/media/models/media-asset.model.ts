import { Schema, Types, model, models, type HydratedDocument, type Model } from 'mongoose';

import { mediaKinds, type MediaKind, type MediaResourceType } from '../types/media.types';

export type MediaAsset = {
  ownerId: Types.ObjectId;
  kind: MediaKind;
  publicId: string;
  secureUrl: string;
  resourceType: MediaResourceType;
  format: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MediaAssetDocument = HydratedDocument<MediaAsset>;

const mediaAssetSchema = new Schema<MediaAsset>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: mediaKinds,
      required: true,
      index: true,
    },
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    secureUrl: {
      type: String,
      required: true,
    },
    resourceType: {
      type: String,
      enum: ['image', 'video', 'raw'],
      required: true,
    },
    format: {
      type: String,
      default: null,
    },
    bytes: {
      type: Number,
      required: true,
      min: 0,
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const MediaAssetModel =
  (models.MediaAsset as Model<MediaAsset> | undefined) ?? model<MediaAsset>('MediaAsset', mediaAssetSchema);
