import { BullQueueService } from './../../../infrastructure/shared/BullQueueService';
import { NextFunction, Request, Response } from 'express';
import { CreateUserUseCase } from '../../../domain/user/use-cases/create-user';
import { SecurityServiceImplementation } from '../../../infrastructure/user/services/SecurityServiceImplementation';
import { PrismaUserRepository } from '../../../infrastructure/user/repositories/PrismaUserRepository';

export const registerUserController = async (req: Request, res: Response, next: NextFunction) => {
  const { name, surname, email, password } = req.body;

  if (!name || !surname || !email || !password) {
    res.status(400).json({ error: 'Los campos name, surname, email y password son obligatorios' });
    return;
  }

  const securityService = new SecurityServiceImplementation();
  const prismaUserRepository = new PrismaUserRepository();
  const bullQueueService = new BullQueueService();

  const createUserUseCase = new CreateUserUseCase(
    prismaUserRepository,
    securityService,
    bullQueueService,
  );

  try {
    await createUserUseCase.execute({
      name,
      surname,
      email,
      password,
    });

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    next(error);
  }
};
