import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { Book } from '../../../domain/book/Book';
import { FindBooksUseCase } from '../../../domain/book/use-cases/find-books';
import { PrismaBookRepository } from '../../../infrastructure/book/repositories/PrismaBookRepository';
import { PaginatedResponse } from '../../shared/types/PaginatedResponse';

const findBooksQueryParamsValidationSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(10),
  search: z.string().min(1).optional(),
});

export const findBooksController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search } = findBooksQueryParamsValidationSchema.parse(req.query);

    const prismaBookRepository = new PrismaBookRepository();

    const findBooksUseCase = new FindBooksUseCase(prismaBookRepository);

    const { books, total } = await findBooksUseCase.execute({
      page,
      limit,
      search,
    });

    const response: PaginatedResponse<Book> = {
      data: books,
      meta: {
        page,
        limit,
        total,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
