import { BookStatus } from '@prisma/client';
import { prisma } from './prisma-client';

// Crea un libro directamente en la base de datos.
// Si no se proporciona un ownerId válido, reutiliza (o crea) un usuario
// real primero para evitar violaciones de la clave foránea Book_ownerId_fkey.
export async function createBook(
  overrides: {
    title?: string;
    description?: string;
    price?: number;
    author?: string;
    status?: BookStatus;
    soldAt?: Date | null;
    ownerId?: number;
    createdAt?: Date;
  } = {},
) {
  let ownerId = overrides.ownerId;

  if (!ownerId) {
    const owner = await prisma.user.upsert({
      where: { email: 'create-book-owner@domain.com' },
      update: {},
      create: {
        email: 'create-book-owner@domain.com',
        password: 'hashedPassword123*',
      },
    });
    ownerId = owner.id;
  }

  return prisma.book.create({
    data: {
      title: 'Test Book',
      description: 'Test description for a second hand book',
      price: 15.5,
      author: 'Test Author',
      ...overrides,
      ownerId,
    },
  });
}
