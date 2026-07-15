import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra;
const configuredApiUrl = typeof extra?.apiUrl === 'string' ? extra.apiUrl : null;

export const apiConfig = {
  baseUrl: configuredApiUrl ?? 'http://localhost:5000/api/v1',
};
