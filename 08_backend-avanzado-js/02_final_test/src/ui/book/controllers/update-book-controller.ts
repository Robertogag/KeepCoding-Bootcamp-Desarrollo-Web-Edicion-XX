import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { UpdateBookUseCase } from '../../../domain/book/use-cases/update-book';
import { PrismaBookRepository } from '../../../infrastructure/book/repositories/PrismaBookRepository';

// strictObject: si llega cualquier propiedad no editable
// (status, soldAt, ownerId...) la request se rechaza con 400
const updateBookValidationSchema = z.strictObject({
  title: z.string().min(1, 'Title can not be empty').optional(),
  description: z.string().min(1, 'Description can not be empty').optional(),
  price: z.number().positive('Price must be a positive number').optional(),
  author: z.string().min(1, 'Author can not be empty').optional(),
});

const idParamValidationSchema = z.coerce.number().int().positive();

export const updateBookController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = idParamValidationSchema.parse(req.params.id);
    const fields = updateBookValidationSchema.parse(req.body);

    const prismaBookRepository = new PrismaBookRepository();

    const updateBookUseCase = new UpdateBookUseCase(prismaBookRepository);

    const updatedBook = await updateBookUseCase.execute({
      id,
      userId: req.userId!,
      fields,
    });

    res.status(200).json(updatedBook);
  } catch (error) {
    next(error);
  }
};
