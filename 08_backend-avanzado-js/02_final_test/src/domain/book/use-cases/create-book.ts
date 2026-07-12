import { Book } from '../Book';
import { BookRepository } from '../repositories/BookRepository';

export interface CreateBookUseCaseInput {
  title: string;
  description: string;
  price: number;
  author: string;
  ownerId: number;
}

export class CreateBookUseCase {
  constructor(private readonly bookRepository: BookRepository) {}

  async execute(input: CreateBookUseCaseInput): Promise<Book> {
    // regla de negocio: no se pueden publicar libros con precio negativo o cero
    if (input.price <= 0) {
      throw new Error('Price must be a positive number');
    }

    // el libro se asocia al usuario autenticado y nace en estado
    // PUBLISHED con soldAt = null (lo garantiza el repositorio/schema)
    const book = await this.bookRepository.create(input);

    return book;
  }
}
