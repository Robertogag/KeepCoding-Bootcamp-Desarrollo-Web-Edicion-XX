import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { RemoveBookUseCase } from '../../../domain/book/use-cases/remove-book';
import { PrismaBookRepository } from '../../../infrastructure/book/repositories/PrismaBookRepository';

const idParamValidationSchema = z.coerce.number().int().positive();

export const removeBookController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = idParamValidationSchema.parse(req.params.id);

    const prismaBookRepository = new PrismaBookRepository();

    const removeBookUseCase = new RemoveBookUseCase(prismaBookRepository);

    await removeBookUseCase.execute({
      id,
      userId: req.userId!,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
