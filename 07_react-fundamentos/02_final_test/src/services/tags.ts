import { fetchOptional } from './api';

export async function getTags() {
    const tags = await fetchOptional<string[]>('/api/tags');
    return tags ?? [];
}
