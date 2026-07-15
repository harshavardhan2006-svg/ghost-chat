export const socketEvents = {
  connection: 'connection',
  disconnect: 'disconnect',
  joinChat: 'join-chat',
  leaveChat: 'leave-chat',
  typing: 'typing',
  stopTyping: 'stop-typing',
  message: 'message',
  delivered: 'delivered',
  online: 'online',
  offline: 'offline',
  seen: 'seen',
  reaction: 'reaction',
  reply: 'reply',
  deleteMessage: 'delete-message',
  pairingCompleted: 'pairing-completed',
  unpaired: 'unpaired',
  socketError: 'socket-error',
} as const;

export type SocketEvent = (typeof socketEvents)[keyof typeof socketEvents];
