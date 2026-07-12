import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { CreateUserUseCase } from '../../../domain/user/use-cases/create-user';
import { PrismaUserRepository } from '../../../infrastructure/user/repositories/PrismaUserRepository';
import { SecurityServiceImplementation } from '../../../infrastructure/user/services/SecurityServiceImplementation';

const registerUserValidationSchema = z.object({
  email: z.email('Email is not valid'),
  password: z
    .string()
    .regex(
      /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,20}$/,
      'Password must be 8-20 chars and include lowercase, uppercase, number and symbol',
    ),
});

export const registerUserController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = registerUserValidationSchema.parse(req.body);

    const prismaUserRepository = new PrismaUserRepository();
    const securityService = new SecurityServiceImplementation();

    const createUserUseCase = new CreateUserUseCase(prismaUserRepository, securityService);

    await createUserUseCase.execute({
      email,
      password,
    });

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    next(error);
  }
};
