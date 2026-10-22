import { clearSession, getAccessToken, setAccessToken } from '@/lib/auth/session';
import { apiBaseUrl } from '@/lib/env';
import { isServer } from '@/lib/runtime';
import { ensureMocks, mockResponse } from '@/mocks/ready';
import type { ApiErrorBody } from './types';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'USERNAME_TAKEN'
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'NOT_AUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_TOKEN'
  | 'WRONG_PASSWORD'
  | 'MODBUS_UNREACHABLE'
  | 'SLUG_TAKEN'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly field: string | undefined;

  constructor(status: number, code: ErrorCode, field?: string) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorCode(error: unknown): ErrorCode {
  return isApiError(error) ? error.code : 'UNKNOWN';
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export function buildUrl(path: string, query?: QueryParams): string {
  const url = new URL(apiBaseUrl().replace(/\/$/, '') + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers = new Headers(options.headers);
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers.set('Content-Type', 'application/json');
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const url = buildUrl(path, options.query);
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
    body: isForm
      ? (options.body as FormData)
      : options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
    credentials: 'include',
    signal: options.signal,
  };

  // Un fallo de los mocks del servidor es un error de programación: se deja ver, no se disfraza de red.
  if (isServer) {
    const mocked = await mockResponse(new Request(url, init));
    if (mocked) return mocked;
  }
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR');
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = null;
  }
  if (body?.error?.code) {
    throw new ApiError(response.status, body.error.code as ErrorCode, body.error.field);
  }
  throw new ApiError(response.status, response.status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN');
}

type RefreshResult = 'ok' | 'rejected' | 'unavailable';
let refreshInFlight: Promise<RefreshResult> | null = null;

// Una sola renovación en curso: las peticiones concurrentes con 401 esperan la misma promesa.
export function refreshAccessToken(): Promise<RefreshResult> {
  refreshInFlight ??= (async () => {
    try {
      const response = await send('/auth/refresh', { method: 'POST' });
      if (response.status === 401) return 'rejected';
      if (!response.ok) return 'unavailable';
      const data = (await response.json()) as { access_token: string };
      setAccessToken(data.access_token);
      return 'ok';
    } catch {
      return 'unavailable';
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function canRefresh(path: string): boolean {
  return !isServer && !path.startsWith('/auth/');
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  await ensureMocks();
  const response = await send(path, options);
  if (response.status !== 401 || !canRefresh(path)) return parse<T>(response);

  const refreshed = await refreshAccessToken();
  if (refreshed === 'unavailable') throw new ApiError(0, 'NETWORK_ERROR');
  if (refreshed === 'rejected') {
    clearSession();
    throw new ApiError(401, 'NOT_AUTHENTICATED');
  }
  return parse<T>(await send(path, options));
}

export async function requestBlob(
  path: string,
  options: RequestOptions = {},
): Promise<{ blob: Blob; filename: string | null }> {
  await ensureMocks();
  let response = await send(path, options);
  if (response.status === 401 && canRefresh(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed === 'unavailable') throw new ApiError(0, 'NETWORK_ERROR');
    if (refreshed === 'rejected') {
      clearSession();
      throw new ApiError(401, 'NOT_AUTHENTICATED');
    }
    response = await send(path, options);
  }
  if (!response.ok) await parse<never>(response);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  return { blob: await response.blob(), filename: match?.[1] ?? null };
}
