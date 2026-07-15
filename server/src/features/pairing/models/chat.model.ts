import { Schema, Types, model, models, type HydratedDocument, type Model } from 'mongoose';

export type Chat = {
  participants: [Types.ObjectId, Types.ObjectId];
  friendshipId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatDocument = HydratedDocument<Chat>;

const chatSchema = new Schema<Chat>(
  {
    participants: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: true,
      validate: {
        validator: (participants: Types.ObjectId[]): boolean => participants.length === 2,
        message: 'A private chat must have exactly two participants',
      },
    },
    friendshipId: {
      type: Schema.Types.ObjectId,
      ref: 'Friendship',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const ChatModel = (models.Chat as Model<Chat> | undefined) ?? model<Chat>('Chat', chatSchema);
