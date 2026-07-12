import { api } from '../api';
import { environmentService } from '../infrastructure/EnvironmentService';
import { createUser, CREDENTIALS } from './test-utils/create-user';
import { prisma } from './test-utils/prisma-client';
import request from 'supertest';

beforeAll(() => {
  environmentService.load();
});

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe(' POST /authentication/signin', () => {
  test('Given an existing user with valid pw, generate a JWT', async () => {
    await createUser();

    const response = await request(api).post('/authentication/signin').send({
      email: CREDENTIALS.email,
      password: CREDENTIALS.password,
    });

    expect(response.status).toEqual(200);
    expect(response.body.accessToken).toBeDefined();
  });

  test('Given a not existing user, throw an error', async () => {
    const response = await request(api).post('/authentication/signin').send({
      email: 'not-existing-email@email.com',
      password: 'some-random-pw',
    });

    expect(response.status).toEqual(404);
  });

  test('Given a not valid password, throw an error', async () => {
    await createUser();

    const response = await request(api).post('/authentication/signin').send({
      email: CREDENTIALS.email,
      password: 'not-matching-pw',
    });

    expect(response.status).toEqual(401);
  });

  test('Given no email, throw an error', async () => {
    const response = await request(api).post('/authentication/signin').send({
      password: 'not-matching-pw',
    });

    expect(response.status).toEqual(400);
  });

  test('Given no password, throw an error', async () => {
    const response = await request(api).post('/authentication/signin').send({
      email: 'random@email.com',
    });

    expect(response.status).toEqual(400);
  });
});
