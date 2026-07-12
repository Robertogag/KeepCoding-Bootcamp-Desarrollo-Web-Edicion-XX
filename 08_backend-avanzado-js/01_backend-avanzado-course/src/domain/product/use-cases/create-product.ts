import { QueueService } from '../../shared/QueueService';
import { Product } from '../Product';
import { ProductRepository } from '../repositories/ProductRepository';

export interface CreateProductUseCaseInput {
  name: string;
  description: string;
  price: number;
  userId: number;
}

export class CreateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly queueService: QueueService,
  ) {}

  // al caso de uso llegará name, description y price.
  async execute(input: CreateProductUseCaseInput): Promise<Product> {
    // regla de negocio: no se pueden crear productos con precio < 0
    if (input.price < 0) {
      throw new Error('No se pueden crear productos con precio negativo');
    }

    // caso de uso --> guardar producto.
    const product = await this.productRepository.create(input);

    this.queueService.sendProductCreatedEmail({
      userId: input.userId.toString(),
      productName: product.name,
    });

    // Devolverá un product.
    return product;
  }
}
