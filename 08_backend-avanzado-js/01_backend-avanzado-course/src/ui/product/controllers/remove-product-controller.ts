import { NextFunction, Request, Response } from 'express';
import { RemoveProductUseCase } from '../../../domain/product/use-cases/remove-product';
import { PrismaProductRepository } from '../../../infrastructure/product/repositories/PrismaProductRepository';

export const removeProductController = async (req: Request, res: Response, next: NextFunction) => {
  const id = Number(req.params.id);

  const prismaProductRepository = new PrismaProductRepository();
  const removeProductUseCase = new RemoveProductUseCase(prismaProductRepository);

  try {
    await removeProductUseCase.execute({
      id,
      userId: req.userId!,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
