import { Product } from '../Product';
import { CreateProductUseCaseInput } from '../use-cases/create-product';
import { FindProductsUseCaseInput } from '../use-cases/find-products';

export interface ProductRepository {
  create: (params: CreateProductUseCaseInput) => Promise<Product>;
  remove: (id: number) => Promise<void>;
  findById: (id: number) => Promise<Product | null>;
  isProductAvailable: (id: number) => Promise<boolean>;
  findMany: (criteria: FindProductsUseCaseInput) => Promise<{ products: Product[]; total: number }>;
}
