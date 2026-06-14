import { API_URL } from './api';

interface LoginResponse {
    accessToken?: string;
    token?: string;
}

interface UserLookupResponse {
    username?: string;
}

async function readErrorMessage(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.message ?? 'No se pudo iniciar sesión';
}

async function resolveUsername(identifier: string) {
    if (!identifier.includes('@')) {
        return identifier;
    }

    const response = await fetch(
        `${API_URL}/api/users?email=${encodeURIComponent(identifier)}`,
    );

    if (!response.ok) {
        return identifier;
    }

    const users = (await response.json()) as UserLookupResponse[];
    const username = users[0]?.username;

    return typeof username === 'string' ? username : identifier;
}

async function sendLogin(path: string, body: Record<string, string>) {
    const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(await readErrorMessage(response));
    }

    return (await response.json()) as LoginResponse;
}

export async function login(identifier: string, password: string) {
    const username = await resolveUsername(identifier);
    const body = {
        username,
        name: username,
        email: identifier,
        password,
    };

    const response =
        (await sendLogin('/auth/login', body)) ??
        (await sendLogin('/api/auth/login', body));

    const token = response?.accessToken ?? response?.token;

    if (!token) {
        throw new Error('No se pudo obtener el token');
    }

    return token;
}
