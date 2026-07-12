import { NextFunction, Request, Response } from 'express';
import { FindMyBooksUseCase } from '../../../domain/book/use-cases/find-my-books';
import { PrismaBookRepository } from '../../../infrastructure/book/repositories/PrismaBookRepository';

export const findMyBooksController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prismaBookRepository = new PrismaBookRepository();

    const findMyBooksUseCase = new FindMyBooksUseCase(prismaBookRepository);

    const books = await findMyBooksUseCase.execute({
      userId: req.userId!,
    });

    res.status(200).json(books);
  } catch (error) {
    next(error);
  }
};
