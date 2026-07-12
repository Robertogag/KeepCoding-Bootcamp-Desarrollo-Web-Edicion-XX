import request from 'supertest';
import { api } from '../api';
import { prisma } from './test-utils/prisma-client';
import { createUser, signinUser } from './test-utils/create-user';
import { environmentService } from '../infrastructure/EnvironmentService';

beforeAll(() => {
  environmentService.load();
});

beforeEach(async () => {
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /products', () => {
  test('Returns a response with status code 201 and the created product', async () => {
    await createUser();
    const token = await signinUser();

    const response = await request(api)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'product test 1',
        description: 'fancy description long enough to pass trough validations',
        price: 3.99,
      });

    expect(response.status).toEqual(201);

    expect(response.body.name).toEqual('product test 1');
    expect(response.body.description).toBeDefined();
    expect(response.body.price).toEqual(3.99);
    expect(response.body.id).toBeDefined();
    expect(response.body.createdAt).toBeDefined();
    expect(response.body.updatedAt).toBeDefined();

    const createdProductId = response.body.id;

    const product = await prisma.product.findUnique({
      where: {
        id: createdProductId,
      },
    });

    expect(product).toBeDefined();
  });

  test('An error is returned when name, description or price is not sent', async () => {
    await createUser();
    const token = await signinUser();

    const noDescriptionResponse = await request(api)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'product test 1',
        price: 3.99,
      });

    expect(noDescriptionResponse.status).toEqual(400);

    const noNameResponse = await request(api)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'product desc',
        price: 3.99,
      });

    expect(noNameResponse.status).toEqual(400);

    const noPriceResponse = await request(api)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'product test 1',
        description: 'product desc',
      });

    expect(noPriceResponse.status).toEqual(400);
  });

  test('Returns a 401 status code when token is not present', async () => {
    const response = await request(api).post('/products').send({
      name: 'product test 1',
      description: 'fancy desc',
      price: 3.99,
    });

    expect(response.status).toEqual(401);
  });

  test('Returns a 401 status code when token is not valid', async () => {
    const response = await request(api)
      .post('/products')
      .set('Authorization', 'Bearer eynfoians.dosidsods.cinuiovbf')
      .send({
        name: 'product test 1',
        description: 'fancy desc',
        price: 3.99,
      });

    expect(response.status).toEqual(401);
  });
});
