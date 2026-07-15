import { Schema, Types, model, models, type HydratedDocument, type Model } from 'mongoose';

import { messageStatuses, messageTypes, type MessageStatus, type MessageType } from '../types/message.types';

type MessageReaction = {
  userId: Types.ObjectId;
  emoji: string;
  createdAt: Date;
};

export type Message = {
  chatId: Types.ObjectId;
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  clientMessageId: string | null;
  type: MessageType;
  text: string;
  replyToMessageId: Types.ObjectId | null;
  reactions: MessageReaction[];
  status: MessageStatus;
  deliveredAt: Date | null;
  seenAt: Date | null;
  deletedAt: Date | null;
  deleteAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MessageDocument = HydratedDocument<Message>;

const reactionSchema = new Schema<MessageReaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    emoji: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

const messageSchema = new Schema<Message>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientMessageId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 128,
    },
    type: {
      type: String,
      enum: messageTypes,
      required: true,
      default: 'text',
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    replyToMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    status: {
      type: String,
      enum: messageStatuses,
      required: true,
      default: 'sent',
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    seenAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deleteAt: {
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

messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index(
  { deleteAt: 1, deletedAt: 1 },
  {
    partialFilterExpression: {
      deleteAt: { $type: 'date' },
    },
  },
);
messageSchema.index(
  { senderId: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clientMessageId: { $type: 'string' },
    },
  },
);

export const MessageModel =
  (models.Message as Model<Message> | undefined) ?? model<Message>('Message', messageSchema);
