import request from 'supertest';
import { api } from '../api';
import { environmentService } from '../infrastructure/EnvironmentService';
import { createBook } from './test-utils/create-book';
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

describe('GET /books', () => {
  test('Obtención paginada: respeta page y limit y devuelve el total', async () => {
    for (let i = 1; i <= 15; i++) {
      await createBook({ title: `Libro ${i}` });
    }

    const firstPageResponse = await request(api).get('/books?page=1&limit=10');

    expect(firstPageResponse.status).toEqual(200);
    expect(firstPageResponse.body.data).toHaveLength(10);
    expect(firstPageResponse.body.meta).toEqual({ page: 1, limit: 10, total: 15 });

    const secondPageResponse = await request(api).get('/books?page=2&limit=10');

    expect(secondPageResponse.status).toEqual(200);
    expect(secondPageResponse.body.data).toHaveLength(5);
    expect(secondPageResponse.body.meta).toEqual({ page: 2, limit: 10, total: 15 });
  });

  test('Búsqueda parcial por título (insensible a mayúsculas)', async () => {
    await createBook({ title: 'Clean Code', author: 'Robert C. Martin' });
    await createBook({ title: 'El Quijote', author: 'Miguel de Cervantes' });

    const response = await request(api).get('/books?search=clean');

    expect(response.status).toEqual(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toEqual('Clean Code');
  });

  test('Búsqueda parcial por autor (insensible a mayúsculas)', async () => {
    await createBook({ title: 'Harry Potter', author: 'J. K. Rowling' });
    await createBook({ title: 'El Quijote', author: 'Miguel de Cervantes' });

    const response = await request(api).get('/books?search=row');

    expect(response.status).toEqual(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].author).toEqual('J. K. Rowling');
  });

  test('Exclusión de libros vendidos: los SOLD no aparecen en el catálogo', async () => {
    await createBook({ title: 'Libro publicado' });
    await createBook({ title: 'Libro vendido', status: 'SOLD', soldAt: new Date() });

    const response = await request(api).get('/books');

    expect(response.status).toEqual(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toEqual('Libro publicado');
    expect(response.body.meta.total).toEqual(1);

    // tampoco aparecen aunque coincidan con la búsqueda
    const searchResponse = await request(api).get('/books?search=vendido');

    expect(searchResponse.status).toEqual(200);
    expect(searchResponse.body.data).toHaveLength(0);
  });
});
