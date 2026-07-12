import express from 'express';
import { booksRouter } from './ui/book/routes/books';
import { meRouter } from './ui/book/routes/me';
import { errorHandlerMiddleware } from './ui/shared/middlewares/error-handler-middleware';
import { userRouter } from './ui/user/routes/user-route';

const api = express();

api.use(express.json());

api.use('/authentication', userRouter);
api.use('/books', booksRouter);
api.use('/me', meRouter);

api.use(errorHandlerMiddleware);

export { api };
