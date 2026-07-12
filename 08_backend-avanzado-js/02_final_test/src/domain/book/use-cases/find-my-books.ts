import { Book } from '../Book';
import { BookRepository } from '../repositories/BookRepository';

export interface FindMyBooksUseCaseInput {
  userId: number;
}

export class FindMyBooksUseCase {
  constructor(private readonly bookRepository: BookRepository) {}

  // devuelve todos los libros del usuario autenticado,
  // independientemente de su estado (PUBLISHED o SOLD)
  async execute(input: FindMyBooksUseCaseInput): Promise<Book[]> {
    return this.bookRepository.findByOwner(input.userId);
  }
}
