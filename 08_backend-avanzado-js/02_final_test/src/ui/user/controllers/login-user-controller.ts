import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { LoginUserUseCase } from '../../../domain/user/use-cases/login-user';
import { PrismaUserRepository } from '../../../infrastructure/user/repositories/PrismaUserRepository';
import { SecurityServiceImplementation } from '../../../infrastructure/user/services/SecurityServiceImplementation';

const loginUserValidationSchema = z.object({
  email: z.email('Email is not valid'),
  password: z.string().min(1, 'Password is required'),
});

export const loginUserController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginUserValidationSchema.parse(req.body);

    const userRepository = new PrismaUserRepository();
    const securityService = new SecurityServiceImplementation();

    const loginUserUseCase = new LoginUserUseCase(userRepository, securityService);

    const token = await loginUserUseCase.execute({
      email,
      password,
    });

    res.status(200).json({
      accessToken: token,
    });
  } catch (error) {
    next(error);
  }
};
