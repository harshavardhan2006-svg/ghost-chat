import { Schema, Types, model, models, type HydratedDocument, type Model } from 'mongoose';

export type PairingCode = {
  ownerId: Types.ObjectId;
  codeHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PairingCodeDocument = HydratedDocument<PairingCode>;

const pairingCodeSchema = new Schema<PairingCode>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

pairingCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PairingCodeModel =
  (models.PairingCode as Model<PairingCode> | undefined) ?? model<PairingCode>('PairingCode', pairingCodeSchema);
