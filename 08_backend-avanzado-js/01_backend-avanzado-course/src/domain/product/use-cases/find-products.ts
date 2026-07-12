import { Pagination } from '../../shared/Pagination';
import { Product } from '../Product';
import { ProductRepository } from './../repositories/ProductRepository';

interface ProductFilterQuery {
  search?: string;
  price?: number;
}

export type FindProductsUseCaseInput = Pagination & ProductFilterQuery;

export class FindProductsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(
    criteria: FindProductsUseCaseInput,
  ): Promise<{ products: Product[]; total: number }> {
    const { products, total } = await this.productRepository.findMany(criteria);

    return {
      products,
      total,
    };
  }
}
