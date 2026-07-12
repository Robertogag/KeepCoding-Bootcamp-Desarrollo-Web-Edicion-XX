import { QueueService } from '../../domain/shared/QueueService';

import { Queue } from 'bullmq';
import { environmentService } from '../EnvironmentService';

export class BullQueueService implements QueueService {
  private readonly welcomeEmailQueue: Queue;
  private readonly productCreatedEmail: Queue;

  constructor() {
    const { REDIS_URL } = environmentService.get();
    const redisUrl = new URL(REDIS_URL);
    const connection = {
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port),
      },
    };
    this.welcomeEmailQueue = new Queue('user-welcome-email', connection);
    this.productCreatedEmail = new Queue('user-product-created-email', connection);
  }
  async sendWelcomeEmail(params: { email: string; name: string }) {
    await this.welcomeEmailQueue.add('user-welcome-email-job', params);
  }

  async sendProductCreatedEmail(params: { userId: string; productName: string }) {
    await this.productCreatedEmail.add('user-product-created-email-job', params);
  }
}
