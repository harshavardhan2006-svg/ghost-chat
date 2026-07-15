import { socketEvents } from '../../../socket/events';
import { getSocketServer } from '../../../socket/socket-state';
import { userRoom } from '../../realtime/services/room.service';
import { type PairingCompletedResponse } from '../types/pairing.types';

export const emitPairingCompleted = (payload: PairingCompletedResponse): void => {
  const io = getSocketServer();

  if (io === null) {
    return;
  }

  for (const userId of payload.friendship.participantIds) {
    io.to(userRoom(userId)).emit(socketEvents.pairingCompleted, payload);
  }
};
