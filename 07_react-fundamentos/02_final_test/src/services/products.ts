import type { Product, ProductCreateDto } from '../types';
import { apiRequest, fetchOptional } from './api';

interface RawProduct {
    id: number;
    name?: string;
    price?: number | string;
    tags?: unknown;
    image?: unknown;
    isOnSale?: unknown;
    description?: unknown;
    userId?: number;
    createdAt?: string;
    updatedAt?: string;
}

function normalizeTags(tags: unknown) {
    if (!Array.isArray(tags)) {
        return [];
    }

    return tags.filter((tag): tag is string => typeof tag === 'string');
}

function normalizeProduct(product: RawProduct): Product {
    return {
        id: product.id,
        name: typeof product.name === 'string' ? product.name : 'Sin nombre',
        price:
            typeof product.price === 'number'
                ? product.price
                : Number(product.price) || 0,
        tags: normalizeTags(product.tags),
        image: typeof product.image === 'string' ? product.image : undefined,
        isOnSale: Boolean(product.isOnSale),
        description:
            typeof product.description === 'string' ? product.description : '',
        userId: product.userId,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
    };
}

export async function getProducts() {
    const products = await apiRequest<RawProduct[]>('/api/products');
    return products.map(normalizeProduct);
}

export async function getProductById(id: number) {
    const product = await fetchOptional<RawProduct>(`/api/products/${id}`);
    return product ? normalizeProduct(product) : null;
}

export async function createProduct(product: ProductCreateDto) {
    const newProduct = await apiRequest<RawProduct>('/api/products', {
        method: 'POST',
        body: JSON.stringify(product),
    });

    return normalizeProduct(newProduct);
}

export async function updateProduct(id: number, product: ProductCreateDto) {
    const updatedProduct = await apiRequest<RawProduct>(`/api/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(product),
    });

    return normalizeProduct(updatedProduct);
}

export async function deleteProduct(id: number) {
    await apiRequest<unknown>(`/api/products/${id}`, {
        method: 'DELETE',
    });
}
