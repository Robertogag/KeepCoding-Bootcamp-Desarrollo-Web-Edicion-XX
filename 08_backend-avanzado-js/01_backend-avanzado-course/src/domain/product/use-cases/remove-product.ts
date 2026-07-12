import { EntityNotFoundError } from '../../errors/EntityNotFoundError';
import { ForbiddenOperationError } from '../../errors/ForbiddenOperationError';
import { ProductRepository } from '../repositories/ProductRepository';

export interface RemoveProductUseCaseInput {
  id: number;
  userId: number;
}

export class RemoveProductUseCase {
  private readonly productRepository: ProductRepository;
  constructor(productRepository: ProductRepository) {
    this.productRepository = productRepository;
  }

  // recibirá un id del producto  a borrar
  async execute(input: RemoveProductUseCaseInput): Promise<void> {
    const productToDelete = await this.productRepository.findById(input.id);

    if (!productToDelete) {
      throw new EntityNotFoundError('Product', input.id.toString());
    } else {
      if (input.userId === productToDelete.userId) {
        await this.productRepository.remove(input.id);
      } else {
        throw new ForbiddenOperationError('No eres el dueño del producto');
      }
    }
  }
}
