import { PrismaProductRepository } from './../../../infrastructure/product/repositories/PrismaProductRepository';
import { FindProductsUseCase } from '../../../domain/product/use-cases/find-products';
import { NextFunction, Request, Response } from 'express';
import z from 'zod';
import { Product } from '../../../domain/product/Product';
import { PaginatedResponse } from '../../shared/types/PaginatedResponse';

const findProductQueryParamsSchemaValidator = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(10),
  search: z.string().min(3).optional(),
});

export const findProductsController = async (req: Request, res: Response, next: NextFunction) => {
  const prismaProductRepository = new PrismaProductRepository();

  const findProductsUseCase = new FindProductsUseCase(prismaProductRepository);

  try {
    const { page, limit, search } = findProductQueryParamsSchemaValidator.parse(req.query);

    const { products, total } = await findProductsUseCase.execute({
      page,
      limit,
      search,
    });

    const response: PaginatedResponse<Product> = {
      data: products,
      meta: {
        limit,
        page,
        total,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
