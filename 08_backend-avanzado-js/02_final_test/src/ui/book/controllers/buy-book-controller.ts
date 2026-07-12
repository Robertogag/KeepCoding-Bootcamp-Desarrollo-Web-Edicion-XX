import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BuyBookUseCase } from '../../../domain/book/use-cases/buy-book';
import { PrismaBookRepository } from '../../../infrastructure/book/repositories/PrismaBookRepository';
import { nodeEventBus } from '../../../infrastructure/shared/NodeEventBus';

const idParamValidationSchema = z.coerce.number().int().positive();

export const buyBookController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookId = idParamValidationSchema.parse(req.params.id);

    const prismaBookRepository = new PrismaBookRepository();

    const buyBookUseCase = new BuyBookUseCase(prismaBookRepository, nodeEventBus);

    const soldBook = await buyBookUseCase.execute({
      bookId,
      buyerId: req.userId!,
    });

    res.status(200).json(soldBook);
  } catch (error) {
    next(error);
  }
};
