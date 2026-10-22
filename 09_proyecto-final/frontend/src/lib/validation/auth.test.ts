import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth';

const t = (key: string) => key;
const schema = registerSchema(t);

const valid = {
  username: 'planta-norte-01',
  email: 'ana@ejemplo.com',
  full_name: 'Ana López',
  password: 'Clave1234',
  language: 'es' as const,
};

function firstIssue(input: unknown): { path: string; message: string } | null {
  const result = schema.safeParse(input);
  if (result.success) return null;
  const issue = result.error.issues[0];
  return issue ? { path: String(issue.path[0]), message: issue.message } : null;
}

describe('registerSchema', () => {
  it('acepta un registro válido', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each(['ab', 'Mayusculas', '-inicio', 'final-', 'con espacio', 'a'.repeat(31)])(
    'rechaza el usuario %s con la clave de traducción',
    (username) => {
      expect(firstIssue({ ...valid, username })).toEqual({ path: 'username', message: 'username' });
    },
  );

  it('acepta usuarios de 3 a 30 caracteres con guiones internos', () => {
    expect(schema.safeParse({ ...valid, username: 'abc' }).success).toBe(true);
    expect(schema.safeParse({ ...valid, username: `a${'-b'.repeat(14)}c` }).success).toBe(true);
  });

  it('exige letra y número en la contraseña', () => {
    expect(firstIssue({ ...valid, password: 'solo-letras' })).toEqual({
      path: 'password',
      message: 'password',
    });
    expect(firstIssue({ ...valid, password: '12345678' })).toEqual({
      path: 'password',
      message: 'password',
    });
    expect(firstIssue({ ...valid, password: 'Ab1' })).toEqual({
      path: 'password',
      message: 'password',
    });
  });

  it('valida correo, nombre e idioma', () => {
    expect(firstIssue({ ...valid, email: 'sin-arroba' })).toEqual({
      path: 'email',
      message: 'email',
    });
    expect(firstIssue({ ...valid, full_name: 'A' })).toEqual({
      path: 'full_name',
      message: 'fullName',
    });
    expect(firstIssue({ ...valid, language: 'fr' })).toEqual({
      path: 'language',
      message: 'language',
    });
  });
});

describe('loginSchema', () => {
  it('solo exige que los campos no estén vacíos', () => {
    const schema = loginSchema(t);
    expect(schema.safeParse({ username: 'demo', password: 'x' }).success).toBe(true);
    const result = schema.safeParse({ username: '  ', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(['required', 'required']);
    }
  });
});
