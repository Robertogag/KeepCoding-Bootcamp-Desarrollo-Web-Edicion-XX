import { Router } from 'express';
import { authenticationMiddleware } from '../../user/middlewares/authentication-middleware';
import { buyBookController } from '../controllers/buy-book-controller';
import { createBookController } from '../controllers/create-book-controller';
import { findBooksController } from '../controllers/find-books-controller';
import { removeBookController } from '../controllers/remove-book-controller';
import { updateBookController } from '../controllers/update-book-controller';

export const booksRouter = Router();

// catálogo público (sin autenticación)
booksRouter.get('/', findBooksController);

// gestión de libros (endpoints privados)
booksRouter.post('/', [authenticationMiddleware, createBookController]);
booksRouter.put('/:id', [authenticationMiddleware, updateBookController]);
booksRouter.delete('/:id', [authenticationMiddleware, removeBookController]);
booksRouter.post('/:id/buy', [authenticationMiddleware, buyBookController]);
