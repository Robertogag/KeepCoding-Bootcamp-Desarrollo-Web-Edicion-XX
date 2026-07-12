import { BusinessConflictError } from '../../errors/BusinessConflictError';
import { EntityNotFoundError } from '../../errors/EntityNotFoundError';
import { ForbiddenOperationError } from '../../errors/ForbiddenOperationError';
import { BookRepository } from '../repositories/BookRepository';

export interface RemoveBookUseCaseInput {
  id: number;
  userId: number;
}

export class RemoveBookUseCase {
  constructor(private readonly bookRepository: BookRepository) {}

  async execute(input: RemoveBookUseCaseInput): Promise<void> {
    const book = await this.bookRepository.findById(input.id);

    if (!book) {
      throw new EntityNotFoundError('Book', input.id.toString());
    }

    // regla de negocio: solo el propietario puede eliminar el libro
    if (book.ownerId !== input.userId) {
      throw new ForbiddenOperationError('No eres el dueño del libro');
    }

    // regla de negocio: solo se pueden eliminar libros publicados
    if (book.status === 'SOLD') {
      throw new BusinessConflictError('No se puede eliminar un libro ya vendido');
    }

    await this.bookRepository.remove(input.id);
  }
}
