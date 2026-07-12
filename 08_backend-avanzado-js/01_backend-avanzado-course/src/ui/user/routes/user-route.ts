import { Router } from 'express';
import { registerUserController } from '../controllers/register-user-controller';
import { loginUserController } from '../controllers/login-user-controller';
import { authenticationMiddleware } from '../middlewares/authentication-middleware';
import { removeUserController } from '../controllers/remove-user-controller';

export const userRouter = Router();

userRouter.post('/signup', registerUserController);
userRouter.post('/signin', loginUserController);
userRouter.delete('/me', [authenticationMiddleware, removeUserController]);
