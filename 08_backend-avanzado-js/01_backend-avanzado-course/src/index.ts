import { api } from './api';
import { environmentService } from './infrastructure/EnvironmentService';
import Sentry from '@sentry/node';
import cron from 'node-cron';
import { Job, Worker } from 'bullmq';
import { PrismaUserRepository } from './infrastructure/user/repositories/PrismaUserRepository';
import { NodemailerEmailService } from './infrastructure/shared/NodemailerEmailService';
import { nodeEventBus } from './infrastructure/shared/NodeEventBus';
import { UserRemovedEvent } from './domain/user/events/UserRemovedEvent';

environmentService.load();

const { PORT, SENTRY_DSN, NODE_ENV, REDIS_URL } = environmentService.get();

Sentry.init({
  dsn: SENTRY_DSN,
  environment: NODE_ENV,
});

api.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

cron.schedule('*/30 * * * * *', () => {
  console.log('cron job working');
});

const redisUrl = new URL(REDIS_URL);
const workerCollection = {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port),
  },
};

new Worker(
  'user-welcome-email',
  async (job: Job<{ email: string; name: string }>) => {
    // process message
    console.log('worker recibiendo mensaje de cola');
    const emailService = new NodemailerEmailService();
    try {
      await emailService.send({
        email: job.data.email,
        message: `Bienvenido a Wallashop ${job.data.name}`,
        subject: 'Producto creado satisfactoriamente',
      });
    } catch (error) {
      console.log(error);
    }
  },
  workerCollection,
);

new Worker(
  'user-product-created-email',
  async (job: Job<{ userId: string; productName: string }>) => {
    console.log('worker recibiendo mensaje de cola');
    const userRepository = new PrismaUserRepository();
    const user = await userRepository.findById(Number(job.data.userId));
    const emailService = new NodemailerEmailService();
    emailService.send({
      email: user?.email ?? '',
      message: `Buenas ${user?.name}, el producto ${job.data.productName} ha sido creado correctamente.`,
      subject: 'Producto creado satisfactoriamente',
    });
  },
  workerCollection,
);

nodeEventBus.subscribe('user.removed', (userRemovedEvent: UserRemovedEvent) => {
  console.log('eyeyey usuario borrado: ' + userRemovedEvent.userId);
  // borrar todos los productos pertenecientes al usuario userRemovedEvent.userId
});
