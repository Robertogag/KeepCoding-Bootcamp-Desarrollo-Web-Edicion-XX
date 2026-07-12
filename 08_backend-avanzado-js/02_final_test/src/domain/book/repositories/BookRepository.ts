import { Book } from '../Book';
import { CreateBookUseCaseInput } from '../use-cases/create-book';
import { FindBooksUseCaseInput } from '../use-cases/find-books';
import { UpdateBookEditableFields } from '../use-cases/update-book';

export interface BookRepository {
  create: (params: CreateBookUseCaseInput) => Promise<Book>;
  findById: (id: number) => Promise<Book | null>;
  update: (id: number, fields: UpdateBookEditableFields) => Promise<Book>;
  remove: (id: number) => Promise<void>;
  // Marca el libro como SOLD solo si sigue PUBLISHED (evita dobles compras).
  // Devuelve null si el libro ya no estaba disponible.
  markAsSold: (id: number, soldAt: Date) => Promise<Book | null>;
  findPublished: (criteria: FindBooksUseCaseInput) => Promise<{ books: Book[]; total: number }>;
  findByOwner: (ownerId: number) => Promise<Book[]>;
  findPublishedOlderThan: (date: Date) => Promise<Book[]>;
}
