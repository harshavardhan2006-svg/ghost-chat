import { Schema, Types, model, models, type HydratedDocument, type Model } from 'mongoose';

export type Friendship = {
  participants: [Types.ObjectId, Types.ObjectId];
  participantKey: string;
  chatId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FriendshipDocument = HydratedDocument<Friendship>;

const friendshipSchema = new Schema<Friendship>(
  {
    participants: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: true,
      validate: {
        validator: (participants: Types.ObjectId[]): boolean => participants.length === 2,
        message: 'A friendship must have exactly two participants',
      },
    },
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const FriendshipModel =
  (models.Friendship as Model<Friendship> | undefined) ?? model<Friendship>('Friendship', friendshipSchema);
