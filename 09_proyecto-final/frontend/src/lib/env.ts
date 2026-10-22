import { isServer } from './runtime';

export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  mocking: process.env.NEXT_PUBLIC_API_MOCKING === 'true',
} as const;

export function apiBaseUrl(): string {
  if (isServer && process.env.API_URL_INTERNAL) {
    return process.env.API_URL_INTERNAL;
  }
  return env.apiUrl;
}

// Las rutas de fotos llegan relativas a la raíz del API; en el navegador se resuelven contra su origen.
export function mediaUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return new URL(path, env.apiUrl).toString();
}
