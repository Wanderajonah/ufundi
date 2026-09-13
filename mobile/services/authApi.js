import api, { setAuthToken } from './api';
import { getItem, setItem, removeItem } from './storage';



/** Match backend Uganda phone format (2567XXXXXXXX). */

export function normalizeUgandaPhone(phone) {
  let n = String(phone || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = `256${n.slice(1)}`;
  if (/^7\d{8}$/.test(n)) n = `256${n}`;
  return n;
}

export const sendOtp = (phone, purpose) =>
  api.post('/auth/otp/send', { phone: normalizeUgandaPhone(phone), purpose });

export const verifyOtpRegister = (payload) =>
  api.post('/auth/otp/verify-register', payload);

// FIX: normalize phone so it matches what sendOtp sent
export const verifyOtpLogin = (phone, code) =>
  api.post('/auth/otp/verify-login', { phone: normalizeUgandaPhone(phone), code });

export const sendGoogleEmailLoginOtp = (idToken) =>
  api.post('/auth/email-otp/google/send', { idToken });

export const verifyEmailLoginOtp = (email, code) =>
  api.post('/auth/email-otp/verify-login', { email: String(email || '').trim().toLowerCase(), code });

export const selectRole = (role, userId) =>
  api.post('/auth/select-role', { role, userId });

export const registerAccount = (payload) => api.post('/auth/register', payload);

/**
 * Handle Google Sign-In response by sending the ID token to the backend
 * for server-side verification with google-auth-library.
 */
export const handleGoogleSignInResponse = async (idToken) => {
  const { data } = await api.post('/auth/google', { idToken });
  return data;
};

// FIX: persist token to storage so it survives app restarts
export const applyAuthSession = async (data) => {
  if (data?.token) {
    setAuthToken(data.token);
    try {
      await setItem('authToken', data.token);
    } catch (e) {
      console.warn('Failed to persist auth token:', e);
    }
  }
  return data;
};

export async function clearAuthSession() {
  setAuthToken('');
  try {
    await removeItem('authToken');
  } catch {
    /* ignore */
  }
}

/** Restore a saved login from storage (survives app restarts / reloads). */
export async function restoreAuthSession() {
  try {
    const token = await getItem('authToken');
    if (!token) return null;

    setAuthToken(token);
    const { data } = await api.get('/users/profile');
    if (!data?.user) {
      await clearAuthSession();
      return null;
    }

    return { token, user: data.user };
  } catch {
    await clearAuthSession();
    return null;
  }
}

export function hasApiAuthToken() {
  return Boolean(api.defaults.headers.common.Authorization);
}

// FIX: only apply Google error mapper for Google-specific errors
export const getErrorMessage = (error) => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?._isGoogleSignInError) return mapGoogleSignInError(error);
  return error?.message || 'Something went wrong. Check your connection and backend URL.';
};
