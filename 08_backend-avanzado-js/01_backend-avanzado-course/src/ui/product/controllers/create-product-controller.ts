import { Request, Response, NextFunction } from 'express';
import { CreateProductUseCase } from '../../../domain/product/use-cases/create-product';
import { PrismaProductRepository } from '../../../infrastructure/product/repositories/PrismaProductRepository';

import { z } from 'zod';
import { BullQueueService } from '../../../infrastructure/shared/BullQueueService';

const createProductValidationSchema = z.object({
  name: z.string().min(5, 'Min length for name is 5 characters'),
  description: z.string().min(30, 'Min length for descrription is 30 characters'),
  price: z.number().positive('Price can not be negative'),
});

export const createProductController = async (req: Request, res: Response, next: NextFunction) => {
  // const { name, description, price } = req.body;

  // validamos datos que obtenemos de la request
  // if (!name || !description || !price) {
  //   res.status(500).json({ error: 'Los campos name, description y price son obligatorios' });
  //   return;
  // }

  try {
    const { name, description, price } = createProductValidationSchema.parse(req.body);

    const prismaProductRepository = new PrismaProductRepository();
    const queueService = new BullQueueService();

    const createProductUseCase = new CreateProductUseCase(prismaProductRepository, queueService);

    const newProduct = await createProductUseCase.execute({
      name,
      description,
      price,
      userId: req.userId!,
    });

    res.status(201).json(newProduct);
  } catch (error) {
    next(error);
  }
};
