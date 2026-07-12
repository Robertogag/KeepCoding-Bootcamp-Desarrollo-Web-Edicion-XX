import request from 'supertest';
import { api } from '../../api';

export const CREDENTIALS = {
  email: 'test-user@domain.com',
  password: 'randomwPassword123*',
};

// Crea un usuario a través de la API.
// Lanza un error si el registro falla, para evitar que el resto del test
// continúe con un usuario que no existe realmente.
export async function createUser(
  overrides: { email?: string; password?: string; name?: string; surname?: string } = {},
) {
  const response = await request(api)
    .post('/authentication/signup')
    .send({
      email: CREDENTIALS.email,
      password: CREDENTIALS.password,
      name: 'Test User',
      surname: 'surname',
      ...overrides,
    });

  if (response.status !== 201) {
    throw new Error(
      `createUser falló con status ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }
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
