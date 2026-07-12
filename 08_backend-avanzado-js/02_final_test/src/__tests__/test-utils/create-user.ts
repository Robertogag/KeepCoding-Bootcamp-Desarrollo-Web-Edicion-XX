import request from 'supertest';
import { api } from '../../api';
import { prisma } from './prisma-client';

export const CREDENTIALS = {
  email: 'test-user@domain.com',
  password: 'randomPassword123*',
};

// Crea un usuario a través de la API.
// Lanza un error si el registro falla, para evitar que el resto del test
// continúe con un usuario que no existe realmente.
export async function createUser(overrides: { email?: string; password?: string } = {}) {
  const email = overrides.email ?? CREDENTIALS.email;

  const response = await request(api)
    .post('/authentication/signup')
    .send({
      email,
      password: CREDENTIALS.password,
      ...overrides,
    });

  if (response.status !== 201) {
    throw new Error(
      `createUser falló con status ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error(`createUser: el usuario ${email} no se encuentra en la base de datos`);
  }

  return user;
}

export async function signinUser(overrides: { email?: string; password?: string } = {}) {
  const response = await request(api)
    .post('/authentication/signin')
    .send({
      email: CREDENTIALS.email,
      password: CREDENTIALS.password,
      ...overrides,
    });

  return response.body.accessToken;
}
