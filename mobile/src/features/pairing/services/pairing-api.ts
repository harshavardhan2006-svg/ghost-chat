import { requestApi } from '../../../shared/api/api-client';
import {
  type PairingCodeResponse,
  type PairingCompletedResponse,
  type PairingStatusResponse,
} from '../types/pairing.types';

export const pairingApi = {
  generateCode: async (accessToken: string): Promise<PairingCodeResponse> =>
    requestApi<PairingCodeResponse>('/pairing/code', {
      method: 'POST',
      accessToken,
    }),

  pairWithCode: async (code: string, accessToken: string): Promise<PairingCompletedResponse> =>
    requestApi<PairingCompletedResponse>('/pairing/pair', {
      method: 'POST',
      body: { code },
      accessToken,
    }),

  getStatus: async (accessToken: string): Promise<PairingStatusResponse> =>
    requestApi<PairingStatusResponse>('/pairing/status', {
      method: 'GET',
      accessToken,
    }),
};
