import { Router } from 'express';
import { authenticationMiddleware } from '../../user/middlewares/authentication-middleware';
import { findMyBooksController } from '../controllers/find-my-books-controller';

export const meRouter = Router();

// todos los libros del usuario autenticado, en cualquier estado
meRouter.get('/books', [authenticationMiddleware, findMyBooksController]);
