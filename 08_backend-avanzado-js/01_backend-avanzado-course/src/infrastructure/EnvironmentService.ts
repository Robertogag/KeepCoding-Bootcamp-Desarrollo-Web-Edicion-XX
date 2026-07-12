import z, { ZodError } from 'zod';
import dotenv from 'dotenv';

const environmentVariablesValidator = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string(),
  NODE_ENV: z.enum(['local', 'staging', 'production', 'test']),
  PORT: z.coerce.number(),
  SENTRY_DSN: z.url(),
  REDIS_URL: z.url(),
  MAILDEV_HOST: z.string(),
  MAILDEV_PORT: z.coerce.number(),
});

type EnvironmentVariables = z.infer<typeof environmentVariablesValidator>;

class EnvironmentService {
  private environmentVariables: EnvironmentVariables | null = null;

  load() {
    if (this.environmentVariables) {
      return;
    }

    dotenv.config();

    try {
      this.environmentVariables = environmentVariablesValidator.parse(process.env);
      console.log('Environment variables loaded');
    } catch (error) {
      if (error instanceof ZodError) {
        throw new Error('Error loading environment variables: ' + error.issues[0].message);
      }
    }
  }

  get(): EnvironmentVariables {
    if (!this.environmentVariables) {
      throw new Error('Environment variables not loaded, call .load() first');
    }
    return this.environmentVariables;
  }
}

export const environmentService = new EnvironmentService();
