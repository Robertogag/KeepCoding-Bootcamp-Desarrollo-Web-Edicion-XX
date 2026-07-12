import { Router } from 'express';
import { loginUserController } from '../controllers/login-user-controller';
import { registerUserController } from '../controllers/register-user-controller';

export const userRouter = Router();

userRouter.post('/signup', registerUserController);
userRouter.post('/signin', loginUserController);
