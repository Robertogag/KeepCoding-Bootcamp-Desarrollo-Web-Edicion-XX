export interface Product {
    id: number;
    name: string;
    price: number;
    tags: string[];
    image?: string;
    isOnSale: boolean;
    description: string;
    userId?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface ProductCreateDto {
    name: string;
    price: number;
    tags: string[];
    image?: string;
    isOnSale: boolean;
    description: string;
}

export interface ProductFormValues {
    name: string;
    price: string;
    tags: string[];
    imageFile: File | null;
    isOnSale: boolean;
    description: string;
}
