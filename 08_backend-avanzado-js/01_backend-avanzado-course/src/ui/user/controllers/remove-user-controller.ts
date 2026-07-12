import { NextFunction, Request, Response } from 'express';
import { RemoveUserUseCase } from '../../../domain/user/use-cases/remove-user';
import { PrismaUserRepository } from '../../../infrastructure/user/repositories/PrismaUserRepository';
import { nodeEventBus } from '../../../infrastructure/shared/NodeEventBus';

export const removeUserController = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.userId!;

  const userRepository = new PrismaUserRepository();

  const removeUserUseCase = new RemoveUserUseCase(userRepository, nodeEventBus);

  try {
    await removeUserUseCase.execute(userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
