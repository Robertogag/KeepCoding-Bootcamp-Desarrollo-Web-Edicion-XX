import { apiRequest } from './api';

interface UploadResponse {
    path: string;
}

export async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiRequest<UploadResponse>('/upload', {
        method: 'POST',
        body: formData,
    });

    return response.path;
}
