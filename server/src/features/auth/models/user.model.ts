import { Schema, Types, model, models, type HydratedDocument, type Model } from 'mongoose';

type UserPairingState = {
  partnerId: Types.ObjectId | null;
  chatId: Types.ObjectId | null;
};

export type User = {
  email: string;
  passwordHash: string;
  refreshTokenHash: string | null;
  pairing: UserPairingState;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserDocument = HydratedDocument<User>;

const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    pairing: {
      partnerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      chatId: {
        type: Schema.Types.ObjectId,
        ref: 'Chat',
        default: null,
      },
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);



export const UserModel =
  (models.User as Model<User> | undefined) ?? model<User>('User', userSchema);
