import { socketEvents } from '../../../socket/events';
import { getSocketServer } from '../../../socket/socket-state';
import { chatRoom, userRoom } from '../../realtime/services/room.service';
import { type MessageResponse } from '../types/message.types';

const emitToMessageTargets = (event: string, message: MessageResponse): void => {
  const io = getSocketServer();

  if (io === null) {
    return;
  }

  io.to(chatRoom(message.chatId)).emit(event, message);
  io.to(userRoom(message.senderId)).emit(event, message);
  io.to(userRoom(message.recipientId)).emit(event, message);
};

export const emitMessageCreated = (message: MessageResponse): void => {
  emitToMessageTargets(socketEvents.message, message);
};

export const emitMessageDelivered = (message: MessageResponse): void => {
  emitToMessageTargets(socketEvents.delivered, message);
};

export const emitMessageSeen = (message: MessageResponse): void => {
  emitToMessageTargets(socketEvents.seen, message);
};

export const emitMessageReaction = (message: MessageResponse): void => {
  emitToMessageTargets(socketEvents.reaction, message);
};

export const emitMessageReply = (message: MessageResponse): void => {
  emitToMessageTargets(socketEvents.reply, message);
};

export const emitMessageDeleted = (message: MessageResponse): void => {
  emitToMessageTargets(socketEvents.deleteMessage, message);
};
