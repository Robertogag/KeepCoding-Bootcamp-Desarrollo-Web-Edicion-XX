import request from 'supertest';
import { api } from '../api';
import { prisma } from './test-utils/prisma-client';
import { environmentService } from '../infrastructure/EnvironmentService';

beforeAll(() => {
  environmentService.load();
});

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /authentication/signup', () => {
  const ENDPOINT = '/authentication/signup';

  test('Given valid data, a ne user is created', async () => {
    const response = await request(api).post(ENDPOINT).send({
      name: 'Keepcoding',
      surname: 'Corporation',
      email: 'hello@kc.com',
      password: 'miPassword123*',
    });

    expect(response.status).toEqual(201);

    const createdUser = await prisma.user.findUnique({
      where: {
        email: 'hello@kc.com',
      },
    });

    expect(createdUser).not.toBeNull();
  });

  test('Given a password not strong enough, an error is thrown', async () => {
    const response = await request(api).post(ENDPOINT).send({
      name: 'Keepcoding',
      surname: 'Corporation',
      email: 'hello@kc.com',
      password: '12345',
    });

    expect(response.status).toEqual(500);
  });

  test('Given an invalid email, an error is thrown', async () => {
    const response = await request(api).post(ENDPOINT).send({
      name: 'Keepcoding',
      surname: 'Corporation',
      email: 'hello',
      password: 'miPassword123*',
    });

    expect(response.status).toEqual(500);
  });

  test('When name is not given, an error is thrown', async () => {
    const response = await request(api).post(ENDPOINT).send({
      surname: 'Corporation',
      email: 'hello@kc.com',
      password: 'miPassword123*',
    });

    expect(response.status).toEqual(400);
  });

  test('When surname is not given, an error is thrown', async () => {
    const response = await request(api).post(ENDPOINT).send({
      name: 'Corporation',
      email: 'hello@kc.com',
      password: 'miPassword123*',
    });

    expect(response.status).toEqual(400);
  });
  test('When email is not given, an error is thrown', async () => {
    const response = await request(api).post(ENDPOINT).send({
      surname: 'Corporation',
      name: 'hello',
      password: 'miPassword123*',
    });

    expect(response.status).toEqual(400);
  });
  test('When password is not given, an error is thrown', async () => {
    const response = await request(api).post(ENDPOINT).send({
      surname: 'Corporation',
      email: 'hello@kc.com',
      name: 'eyeye',
    });

    expect(response.status).toEqual(400);
  });

  test('Given an existing email, an error is thrown', async () => {
    const response1 = await request(api).post(ENDPOINT).send({
      name: 'Keepcoding',
      surname: 'Corporation',
      email: 'hello@kc.com',
      password: 'miPassword123*',
    });

    expect(response1.status).toEqual(201);

    const response2 = await request(api).post(ENDPOINT).send({
      name: 'Keepcoding',
      surname: 'Corporation',
      email: 'hello@kc.com',
      password: 'miPassword123*',
    });

    expect(response2.status).toEqual(409);
  });
});
