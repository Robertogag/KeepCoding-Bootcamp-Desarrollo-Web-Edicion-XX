const TOKEN_KEY = 'authToken';

export function saveToken(token: string, remember: boolean) {
    clearToken();

    if (remember) {
        localStorage.setItem(TOKEN_KEY, token);
        return;
    }

    sessionStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function hasToken() {
    return Boolean(getToken());
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
}
