import { EntityNotFoundError } from '../../errors/EntityNotFoundError';
import { ForbiddenOperationError } from '../../errors/ForbiddenOperationError';
import { Book } from '../Book';
import { BookRepository } from '../repositories/BookRepository';

// Únicos campos editables de un libro. Cualquier otra propiedad
// (status, soldAt, ownerId...) queda fuera del contrato.
export interface UpdateBookEditableFields {
  title?: string;
  description?: string;
  price?: number;
  author?: string;
}

export interface UpdateBookUseCaseInput {
  id: number;
  userId: number;
  fields: UpdateBookEditableFields;
}

export class UpdateBookUseCase {
  constructor(private readonly bookRepository: BookRepository) {}

  async execute(input: UpdateBookUseCaseInput): Promise<Book> {
    const book = await this.bookRepository.findById(input.id);

    if (!book) {
      throw new EntityNotFoundError('Book', input.id.toString());
    }

    // regla de negocio: solo el propietario puede editar el libro
    if (book.ownerId !== input.userId) {
      throw new ForbiddenOperationError('No eres el dueño del libro');
    }

    const updatedBook = await this.bookRepository.update(input.id, input.fields);

    return updatedBook;
  }
}
