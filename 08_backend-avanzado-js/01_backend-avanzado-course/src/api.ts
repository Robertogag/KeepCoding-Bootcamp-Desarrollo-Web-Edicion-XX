import express from 'express';
import { productsRouter } from './ui/product/routes/products';
import { userRouter } from './ui/user/routes/user-route';
import { errorHandlerMiddleware } from './ui/shared/middlewares/error-handler-middleware';

const api = express();

api.use(express.json());

api.use('/products', productsRouter);
api.use('/authentication', userRouter);

api.use(errorHandlerMiddleware);

export { api };
