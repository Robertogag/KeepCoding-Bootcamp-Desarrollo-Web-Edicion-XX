import { Book, BookStatus } from '../../../domain/book/Book';
import { BookRepository } from '../../../domain/book/repositories/BookRepository';
import { CreateBookUseCaseInput } from '../../../domain/book/use-cases/create-book';
import { FindBooksUseCaseInput } from '../../../domain/book/use-cases/find-books';
import { UpdateBookEditableFields } from '../../../domain/book/use-cases/update-book';
import { prisma } from '../../prisma-client';

type PrismaBook = {
  id: number;
  title: string;
  description: string;
  price: number;
  author: string;
  status: string;
  soldAt: Date | null;
  ownerId: number;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaBookRepository implements BookRepository {
  private readonly prisma = prisma;

  async create(params: CreateBookUseCaseInput): Promise<Book> {
    // status (PUBLISHED) y soldAt (null) los establece el schema por defecto
    const prismaBook = await this.prisma.book.create({
      data: {
        title: params.title,
        description: params.description,
        price: params.price,
        author: params.author,
        ownerId: params.ownerId,
      },
    });

    return this.restore(prismaBook);
  }

  async findById(id: number): Promise<Book | null> {
    const prismaBook = await this.prisma.book.findUnique({
      where: {
        id,
      },
    });

    if (!prismaBook) {
      return null;
    }

    return this.restore(prismaBook);
  }

  async update(id: number, fields: UpdateBookEditableFields): Promise<Book> {
    const prismaBook = await this.prisma.book.update({
      where: {
        id,
      },
      data: {
        title: fields.title,
        description: fields.description,
        price: fields.price,
        author: fields.author,
      },
    });

    return this.restore(prismaBook);
  }

  async remove(id: number): Promise<void> {
    await this.prisma.book.delete({
      where: {
        id,
      },
    });
  }

  async markAsSold(id: number, soldAt: Date): Promise<Book | null> {
    // updateMany con filtro por estado: solo vende si sigue PUBLISHED,
    // de forma atómica (dos compradores no pueden comprar el mismo libro)
    const result = await this.prisma.book.updateMany({
      where: {
        id,
        status: 'PUBLISHED',
      },
      data: {
        status: 'SOLD',
        soldAt,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(id);
  }

  async findPublished(criteria: FindBooksUseCaseInput): Promise<{ books: Book[]; total: number }> {
    const { page, limit, search } = criteria;

    // el catálogo público solo muestra libros PUBLISHED; la búsqueda
    // es parcial e insensible a mayúsculas sobre título y autor
    const where = {
      status: 'PUBLISHED' as const,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { author: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [prismaBooks, total] = await Promise.all([
      this.prisma.book.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.book.count({ where }),
    ]);

    return {
      books: prismaBooks.map((prismaBook) => this.restore(prismaBook)),
      total,
    };
  }

  async findByOwner(ownerId: number): Promise<Book[]> {
    const prismaBooks = await this.prisma.book.findMany({
      where: {
        ownerId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return prismaBooks.map((prismaBook) => this.restore(prismaBook));
  }

  async findPublishedOlderThan(date: Date): Promise<Book[]> {
    const prismaBooks = await this.prisma.book.findMany({
      where: {
        status: 'PUBLISHED',
        createdAt: {
          lt: date,
        },
      },
    });

    return prismaBooks.map((prismaBook) => this.restore(prismaBook));
  }

  private restore(prismaBook: PrismaBook): Book {
    return new Book({
      id: prismaBook.id,
      title: prismaBook.title,
      description: prismaBook.description,
      price: prismaBook.price,
      author: prismaBook.author,
      status: prismaBook.status as BookStatus,
      soldAt: prismaBook.soldAt,
      ownerId: prismaBook.ownerId,
      createdAt: prismaBook.createdAt,
      updatedAt: prismaBook.updatedAt,
    });
  }
}
