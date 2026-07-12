import { api } from '../api';
import { environmentService } from '../infrastructure/EnvironmentService';
import { createProduct } from './test-utils/create-product';
import { createUser, signinUser, CREDENTIALS } from './test-utils/create-user';
import { prisma } from './test-utils/prisma-client';
import request from 'supertest';

beforeAll(() => {
  environmentService.load();
});

// Limpiamos productos y usuarios antes de cada test para evitar
// efectos secundarios entre pruebas y entre ficheros de test.
beforeEach(async () => {
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('DELETE /product/:id', () => {
  test('Return a 204 status code when a product is removed successfully', async () => {
    // Creamos un usuario real y obtenemos un token JWT válido
    await createUser();
    const token = await signinUser();

    // Obtenemos el ID del usuario recién creado para asociarlo al producto
    const user = await prisma.user.findUniqueOrThrow({ where: { email: CREDENTIALS.email } });

    // Creamos un producto asociado al usuario real
    const createdProduct = await createProduct({ userId: user.id });

    // Borramos el producto autenticándonos con el token
    const response = await request(api)
      .delete(`/products/${createdProduct.id}`)
      .set('Authorization', `Bearer ${token}`);

    // Verificamos que la respuesta sea 204 (sin contenido)
    expect(response.status).toEqual(204);

    // Verificamos que el producto ya no existe en la base de datos
    const removedProduct = await prisma.product.findUnique({ where: { id: createdProduct.id } });
    expect(removedProduct).toBeNull();
  });

  test('Return a 404 status code error when trying to remove a not existing product', async () => {
    // Creamos un usuario y obtenemos un token para autenticar la petición
    await createUser();
    const token = await signinUser();

    // Intentamos borrar un producto inexistente con un token válido.
    // El middleware de autenticación deja pasar la petición, pero el caso de uso
    // lanza PRODUCT_NOT_FOUND y el controlador devuelve 500.
    const response = await request(api)
      .delete(`/products/545`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toEqual(404);
  });
});
