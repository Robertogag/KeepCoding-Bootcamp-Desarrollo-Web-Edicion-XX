import { prisma } from './prisma-client';

// Crea un producto en la base de datos.
// Si no se proporciona un userId válido, crea un usuario real primero
// para evitar violaciones de la clave foránea Product_userId_fkey.
export async function createProduct(
  overrides: { name?: string; description?: string; price?: number; userId?: number } = {},
) {
  // Si no se ha proporcionado un userId, creamos un usuario real en la BD
  let userId = overrides.userId;
  if (!userId) {
    const user = await prisma.user.create({
      data: {
        email: 'create-product-user@domain.com',
        password: 'hashedPassword123*',
        name: 'Product',
        surname: 'Tester',
      },
    });
    userId = user.id;
  }

  return prisma.product.create({
    data: {
      name: 'Test Product',
      description: 'Test Description very veey long to not break the validation rules',
      price: 29.99,
      userId,
      ...overrides,
    },
  });
}
