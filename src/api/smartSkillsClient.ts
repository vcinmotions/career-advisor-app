import axios from 'axios';
import { Platform } from 'react-native';
import { getSecureItem } from './client';

// 10.0.2.2 is the special alias to your host loopback interface in Android Emulator.
// Replace 192.168.1.X with your actual computer IP if testing on a physical phone via Expo Go.
const LOCAL_HOST_IP = Platform.OS === 'android' ? 'http://10.0.2.2:5001/api/v1' : 'http://localhost:5001/api/v1';

export const SMART_SKILLS_API_BASE_URL =
  process.env.EXPO_PUBLIC_SMART_SKILLS_API_URL || LOCAL_HOST_IP;

if (!__DEV__ && !process.env.EXPO_PUBLIC_SMART_SKILLS_API_URL) {
  throw new Error('EXPO_PUBLIC_SMART_SKILLS_API_URL must be configured for production builds.');
}

export const smartSkillsClient = axios.create({
  baseURL: SMART_SKILLS_API_BASE_URL,
  timeout: 15000, // 15-second timeout safeguard
  headers: { 'Content-Type': 'application/json' },
});

smartSkillsClient.interceptors.request.use(async (config) => {
  const token = await getSecureItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function unwrapList(payload: unknown): any[] {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const data = root.data ?? payload;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.data)) return record.data;
    const nested = record.data;
    if (nested && typeof nested === 'object' && Array.isArray((nested as Record<string, unknown>).items)) {
      return (nested as Record<string, unknown>).items as any[];
    }
  }
  return [];
}

export function apiErrorMessage(error: any, fallback: string) {
  if (error?.message === 'Network Error') {
    return `Unable to reach server at ${SMART_SKILLS_API_BASE_URL}. Ensure your backend server is running and accessible on your local network.`;
  }
  return error?.response?.data?.message || error?.message || fallback;
}
