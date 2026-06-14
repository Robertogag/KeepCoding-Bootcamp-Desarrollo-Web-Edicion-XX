import { getToken } from './auth-storage';

export const API_URL = 'http://localhost:8000';

async function readErrorMessage(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.message ?? 'Ha ocurrido un error';
}

export async function apiRequest<T>(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const token = getToken();

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        throw new Error(await readErrorMessage(response));
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return (await response.json()) as T;
}

export async function fetchOptional<T>(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const token = getToken();

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(await readErrorMessage(response));
    }

    if (response.status === 204) {
        return null;
    }

    return (await response.json()) as T;
}
