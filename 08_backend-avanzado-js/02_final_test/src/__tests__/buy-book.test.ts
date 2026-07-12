import request from 'supertest';
import { api } from '../api';
import { environmentService } from '../infrastructure/EnvironmentService';
import { createBook } from './test-utils/create-book';
import { createUser, signinUser } from './test-utils/create-user';
import { prisma } from './test-utils/prisma-client';

beforeAll(() => {
  environmentService.load();
});

beforeEach(async () => {
  await prisma.book.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const BUYER_EMAIL = 'buyer@domain.com';

describe('POST /books/:id/buy', () => {
  test('Compra correcta: el libro pasa a SOLD y se registra soldAt', async () => {
    const seller = await createUser();
    await createUser({ email: BUYER_EMAIL });
    const buyerToken = await signinUser({ email: BUYER_EMAIL });

    const book = await createBook({ ownerId: seller.id });

    const response = await request(api)
      .post(`/books/${book.id}/buy`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(response.status).toEqual(200);
    expect(response.body.status).toEqual('SOLD');
    expect(response.body.soldAt).not.toBeNull();

    const bookInDb = await prisma.book.findUnique({
      where: {
        id: book.id,
      },
    });

    expect(bookInDb?.status).toEqual('SOLD');
    expect(bookInDb?.soldAt).toBeInstanceOf(Date);
  });

  test('Libro inexistente: devuelve 404', async () => {
    await createUser({ email: BUYER_EMAIL });
    const buyerToken = await signinUser({ email: BUYER_EMAIL });

    const response = await request(api)
      .post('/books/999999/buy')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(response.status).toEqual(404);
  });

  test('Libro ya vendido: devuelve 409 y no vuelve a venderse', async () => {
    const seller = await createUser();
    await createUser({ email: BUYER_EMAIL });
    const buyerToken = await signinUser({ email: BUYER_EMAIL });

    const originalSoldAt = new Date('2026-01-15T10:00:00.000Z');
    const soldBook = await createBook({
      ownerId: seller.id,
      status: 'SOLD',
      soldAt: originalSoldAt,
    });

    const response = await request(api)
      .post(`/books/${soldBook.id}/buy`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(response.status).toEqual(409);

    const bookInDb = await prisma.book.findUnique({
      where: {
        id: soldBook.id,
      },
    });

    expect(bookInDb?.soldAt).toEqual(originalSoldAt);
  });

  test('Compra de un libro propio: devuelve 403 y el libro sigue PUBLISHED', async () => {
    const owner = await createUser();
    const ownerToken = await signinUser();

    const book = await createBook({ ownerId: owner.id });

    const response = await request(api)
      .post(`/books/${book.id}/buy`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toEqual(403);

    const bookInDb = await prisma.book.findUnique({
      where: {
        id: book.id,
      },
    });

    expect(bookInDb?.status).toEqual('PUBLISHED');
    expect(bookInDb?.soldAt).toBeNull();
  });

  test('Usuario no autenticado: devuelve 401', async () => {
    const seller = await createUser();
    const book = await createBook({ ownerId: seller.id });

    const response = await request(api).post(`/books/${book.id}/buy`);

    expect(response.status).toEqual(401);
  });
});
