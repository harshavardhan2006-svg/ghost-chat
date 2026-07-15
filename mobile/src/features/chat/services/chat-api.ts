import { Platform } from 'react-native';
import { apiConfig } from '../../../shared/api/config';
import { requestApi } from '../../../shared/api/api-client';
import { type PartnerDetails, type Message } from '../types/chat.types';

export const chatApi = {
  getPartnerDetails: async (accessToken: string): Promise<PartnerDetails | null> =>
    requestApi<PartnerDetails | null>('/pairing/partner', {
      method: 'GET',
      accessToken,
    }),

  unpair: async (accessToken: string): Promise<void> => {
    await requestApi('/pairing/unpair', {
      method: 'POST',
      accessToken,
    });
  },

  listMessages: async (
    chatId: string,
    accessToken: string,
    query: { limit?: number; before?: string } = {}
  ): Promise<Message[]> => {
    const queryParams = new URLSearchParams();
    if (query.limit !== undefined) {
      queryParams.append('limit', query.limit.toString());
    }
    if (query.before !== undefined) {
      queryParams.append('before', query.before);
    }
    const queryString = queryParams.toString();
    const path = `/chats/${chatId}/messages${queryString ? `?${queryString}` : ''}`;
    const result = await requestApi<{ messages: Message[] }>(path, {
      method: 'GET',
      accessToken,
    });
    return result.messages;
  },

  sendMessage: async (
    chatId: string,
    input: { text: string; clientMessageId?: string; replyToMessageId?: string },
    accessToken: string
  ): Promise<Message> => {
    const result = await requestApi<{ message: Message }>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: input,
      accessToken,
    });
    return result.message;
  },

  markSeen: async (messageId: string, accessToken: string): Promise<Message> => {
    const result = await requestApi<{ message: Message }>(`/messages/${messageId}/seen`, {
      method: 'PATCH',
      accessToken,
    });
    return result.message;
  },

  markDelivered: async (messageId: string, accessToken: string): Promise<Message> => {
    const result = await requestApi<{ message: Message }>(`/messages/${messageId}/delivered`, {
      method: 'PATCH',
      accessToken,
    });
    return result.message;
  },

  setReaction: async (messageId: string, emoji: string, accessToken: string): Promise<Message> => {
    const result = await requestApi<{ message: Message }>(`/messages/${messageId}/reaction`, {
      method: 'PUT',
      body: { emoji },
      accessToken,
    });
    return result.message;
  },

  removeReaction: async (messageId: string, accessToken: string): Promise<Message> => {
    const result = await requestApi<{ message: Message }>(`/messages/${messageId}/reaction`, {
      method: 'DELETE',
      accessToken,
    });
    return result.message;
  },

  deleteMessage: async (messageId: string, accessToken: string): Promise<Message> => {
    const result = await requestApi<{ message: Message }>(`/messages/${messageId}`, {
      method: 'DELETE',
      accessToken,
    });
    return result.message;
  },

  uploadMediaFile: async (
    kind: 'image' | 'voice',
    fileUri: string,
    accessToken: string
  ): Promise<{ secureUrl: string }> => {
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || (kind === 'image' ? 'photo.jpg' : 'audio.m4a');
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `${kind}/${match[1]}` : `${kind}`;

    formData.append('file', {
      uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
      name: filename,
      type,
    } as any);

    const response = await fetch(`${apiConfig.baseUrl}/media/upload/${kind}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error?.message || 'Upload failed');
    }

    return { secureUrl: payload.data.asset.secureUrl };
  },
};
