import request from 'supertest';
import { api } from '../api';
import { environmentService } from '../infrastructure/EnvironmentService';
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

const VALID_BOOK = {
  title: 'Clean Code',
  description: 'Libro en perfecto estado',
  price: 20,
  author: 'Robert C. Martin',
};

describe('POST /books', () => {
  test('Creación correcta: devuelve 201 con el libro PUBLISHED asociado al usuario', async () => {
    const user = await createUser();
    const token = await signinUser();

    const response = await request(api)
      .post('/books')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BOOK);

    expect(response.status).toEqual(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.title).toEqual('Clean Code');
    expect(response.body.description).toEqual('Libro en perfecto estado');
    expect(response.body.price).toEqual(20);
    expect(response.body.author).toEqual('Robert C. Martin');
    expect(response.body.status).toEqual('PUBLISHED');
    expect(response.body.soldAt).toBeNull();
    expect(response.body.ownerId).toEqual(user.id);
    expect(response.body.createdAt).toBeDefined();

    const bookInDb = await prisma.book.findUnique({
      where: {
        id: response.body.id,
      },
    });

    expect(bookInDb).not.toBeNull();
    expect(bookInDb?.status).toEqual('PUBLISHED');
    expect(bookInDb?.soldAt).toBeNull();
    expect(bookInDb?.ownerId).toEqual(user.id);
  });

  test('Usuario no autenticado: devuelve 401 cuando no se envía token', async () => {
    const response = await request(api).post('/books').send(VALID_BOOK);

    expect(response.status).toEqual(401);
  });

  test('Usuario no autenticado: devuelve 401 cuando el token no es válido', async () => {
    const response = await request(api)
      .post('/books')
      .set('Authorization', 'Bearer eynfoians.dosidsods.cinuiovbf')
      .send(VALID_BOOK);

    expect(response.status).toEqual(401);
  });

  test('Datos inválidos: devuelve 400 cuando falta algún campo obligatorio', async () => {
    await createUser();
    const token = await signinUser();

    for (const missingField of ['title', 'description', 'price', 'author']) {
      const invalidBook: Record<string, unknown> = { ...VALID_BOOK };
      delete invalidBook[missingField];

      const response = await request(api)
        .post('/books')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidBook);

      expect(response.status).toEqual(400);
    }
  });

  test('Datos inválidos: devuelve 400 cuando el precio es negativo', async () => {
    await createUser();
    const token = await signinUser();

    const response = await request(api)
      .post('/books')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_BOOK, price: -5 });

    expect(response.status).toEqual(400);

    const booksInDb = await prisma.book.count();
    expect(booksInDb).toEqual(0);
  });
});
