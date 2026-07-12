import { NextFunction, Request, Response } from 'express';
import { LoginUserUseCase } from '../../../domain/user/use-cases/login-user';
import { SecurityServiceImplementation } from '../../../infrastructure/user/services/SecurityServiceImplementation';
import { PrismaUserRepository } from '../../../infrastructure/user/repositories/PrismaUserRepository';

export const loginUserController = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Los campos email y password son obligatorios' });
    return;
  }

  const securityService = new SecurityServiceImplementation();
  const userRepository = new PrismaUserRepository();

  const loginUserUseCase = new LoginUserUseCase(userRepository, securityService);

  try {
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
