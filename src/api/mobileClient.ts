import axios from 'axios';
import { getSecureItem } from './client';
import { SMART_SKILLS_API_BASE_URL } from './smartSkillsClient';

export const LEARNING_API_ORIGIN = SMART_SKILLS_API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const mobileApiClient = axios.create({
  baseURL: SMART_SKILLS_API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

mobileApiClient.interceptors.request.use(async (config) => {
  const token = await getSecureItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function activateCourseWithCoupon(payload: {
  learningCourseId: string;
  couponCode: string;
  idempotencyKey: string;
}) {
  return mobileApiClient.post('/course-activation', {
    learningCourseId: payload.learningCourseId,
    couponCode: payload.couponCode,
  }, {
    headers: {
      'Idempotency-Key': payload.idempotencyKey,
    },
  });
}
