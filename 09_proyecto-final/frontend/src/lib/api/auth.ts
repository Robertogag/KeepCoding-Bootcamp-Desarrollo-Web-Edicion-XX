import { request } from './client';
import type { AuthResponse, Availability, Locale, User } from './types';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  full_name: string;
  password: string;
  language: Locale;
}

export interface ProfilePayload {
  username?: string;
  email?: string;
  full_name?: string;
  language?: Locale;
}

export function login(payload: LoginPayload) {
  return request<AuthResponse>('/auth/login', { method: 'POST', body: payload });
}

export function register(payload: RegisterPayload) {
  return request<AuthResponse>('/auth/register', { method: 'POST', body: payload });
}

export function logoutRequest() {
  return request<void>('/auth/logout', { method: 'POST' });
}

export function forgotPassword(email: string) {
  return request<void>('/auth/password/forgot', { method: 'POST', body: { email } });
}

export function resetPassword(token: string, newPassword: string) {
  return request<void>('/auth/password/reset', {
    method: 'POST',
    body: { token, new_password: newPassword },
  });
}

export function checkAvailability(params: { username?: string; email?: string }) {
  return request<Availability>('/auth/availability', { query: params });
}

export function getMe() {
  return request<User>('/me');
}

export function updateMe(payload: ProfilePayload) {
  return request<User>('/me', { method: 'PATCH', body: payload });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<void>('/me/password', {
    method: 'PUT',
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

export function deleteMe(password: string) {
  return request<void>('/me', { method: 'DELETE', body: { password } });
}
