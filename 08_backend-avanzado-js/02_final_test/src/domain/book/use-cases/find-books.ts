import { Pagination } from '../../shared/Pagination';
import { Book } from '../Book';
import { BookRepository } from '../repositories/BookRepository';

interface BookFilterQuery {
  search?: string;
}

export type FindBooksUseCaseInput = Pagination & BookFilterQuery;

export class FindBooksUseCase {
  constructor(private readonly bookRepository: BookRepository) {}

  // catálogo público: solo devuelve libros PUBLISHED, con búsqueda
  // parcial por título/autor y paginación obligatoria
  async execute(criteria: FindBooksUseCaseInput): Promise<{ books: Book[]; total: number }> {
    const { books, total } = await this.bookRepository.findPublished(criteria);

    return {
      books,
      total,
    };
  }
}
