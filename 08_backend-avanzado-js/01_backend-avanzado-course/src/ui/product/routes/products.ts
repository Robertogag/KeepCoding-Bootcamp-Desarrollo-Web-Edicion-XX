import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createProductController } from '../controllers/create-product-controller';
import { removeProductController } from '../controllers/remove-product-controller';
import { authenticationMiddleware } from '../../user/middlewares/authentication-middleware';
import { findProductsController } from '../controllers/find-products-controller';

const prisma = new PrismaClient();
export const productsRouter = Router();

productsRouter.get('/', findProductsController);

productsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }

    res.json(product);
  } catch {
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
});

productsRouter.post('/', [authenticationMiddleware, createProductController]);

productsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, description, price } = req.body;
    const product = await prisma.product.update({
      where: { id },
      data: { name, description, price },
    });
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});

productsRouter.delete('/:id', [authenticationMiddleware, removeProductController]);
