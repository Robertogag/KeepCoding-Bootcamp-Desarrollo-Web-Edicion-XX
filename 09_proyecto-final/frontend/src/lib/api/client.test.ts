import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, getSession, setSession } from '@/lib/auth/session';
import type { User } from './types';
import { ApiError, buildUrl, request } from './client';

// Las pruebas simulan el navegador: el cliente debe renovar el token y no usar los mocks de servidor.
vi.mock('@/lib/runtime', () => ({ isServer: false }));

const user: User = {
  id: 1,
  username: 'demo',
  email: 'demo@oeelive.test',
  full_name: 'Usuario Demo',
  language: 'es',
  created_at: '2026-01-01T00:00:00Z',
};

const fetchMock = vi.fn<typeof fetch>();

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function authHeader(call: number): string | null {
  const init = fetchMock.mock.calls[call]?.[1];
  return new Headers(init?.headers).get('Authorization');
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  clearSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildUrl', () => {
  it('arma la URL contra el API y omite parámetros vacíos', () => {
    const url = new URL(
      buildUrl('/plants/3/machines', { page: 2, search: '', state: undefined, brand: 'Engel' }),
    );
    expect(url.pathname.endsWith('/api/v1/plants/3/machines')).toBe(true);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('brand')).toBe('Engel');
    expect(url.searchParams.has('search')).toBe(false);
    expect(url.searchParams.has('state')).toBe(false);
  });
});

describe('request', () => {
  it('convierte el error del API en ApiError con código y campo', async () => {
    fetchMock.mockResolvedValueOnce(
      json(409, { error: { code: 'USERNAME_TAKEN', field: 'username' } }),
    );
    const error = await request('/auth/register', { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'USERNAME_TAKEN', field: 'username' });
  });

  it('marca como NETWORK_ERROR un fallo de red', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(request('/plants')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('usa SERVER_ERROR cuando un 5xx no trae el formato de error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('gateway down', { status: 502 }));
    await expect(request('/plants')).rejects.toMatchObject({ status: 502, code: 'SERVER_ERROR' });
  });

  it('devuelve undefined en un 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(request('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('manda el Bearer y las credenciales', async () => {
    setSession(user, 'token-1');
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await request('/me');
    expect(authHeader(0)).toBe('Bearer token-1');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
  });

  it('ante un 401 renueva una sola vez y reintenta con el token nuevo', async () => {
    setSession(user, 'viejo');
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'NOT_AUTHENTICATED' } }))
      .mockResolvedValueOnce(json(200, { access_token: 'nuevo' }))
      .mockResolvedValueOnce(json(200, { items: [] }));

    await expect(request('/plants')).resolves.toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/auth/refresh');
    expect(authHeader(2)).toBe('Bearer nuevo');
    expect(getSession().accessToken).toBe('nuevo');
  });

  it('si el refresh se rechaza cierra la sesión', async () => {
    setSession(user, 'viejo');
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'NOT_AUTHENTICATED' } }))
      .mockResolvedValueOnce(json(401, { error: { code: 'INVALID_TOKEN' } }));

    await expect(request('/plants')).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getSession()).toMatchObject({ status: 'anonymous', user: null, accessToken: null });
  });

  it('si el refresh falla por red no cierra la sesión', async () => {
    setSession(user, 'viejo');
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'NOT_AUTHENTICATED' } }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(request('/plants')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(getSession().status).toBe('authenticated');
  });

  it('no intenta renovar en las rutas de auth', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'INVALID_CREDENTIALS' } }));
    await expect(request('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('comparte una sola renovación entre peticiones concurrentes', async () => {
    setSession(user, 'viejo');
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) return json(200, { access_token: 'nuevo' });
      const token = new Headers(init?.headers).get('Authorization');
      return token === 'Bearer nuevo'
        ? json(200, { ok: true })
        : json(401, { error: { code: 'NOT_AUTHENTICATED' } });
    });

    await Promise.all([request('/plants'), request('/watchlist')]);
    const refreshCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
  });
});
