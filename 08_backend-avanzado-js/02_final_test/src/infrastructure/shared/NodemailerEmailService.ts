import nodemailer from 'nodemailer';
import { EmailService } from '../../domain/shared/EmailService';
import { environmentService } from '../EnvironmentService';

export class NodemailerEmailService implements EmailService {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    const { MAILDEV_HOST, MAILDEV_PORT } = environmentService.get();
    this.transporter = nodemailer.createTransport({
      host: MAILDEV_HOST,
      port: MAILDEV_PORT,
      secure: false,
      ignoreTLS: true,
    });
  }

  async send(params: { email: string; message: string; subject?: string }): Promise<void> {
    await this.transporter.sendMail({
      from: 'BookShop <noreply@bookshop.com>',
      to: params.email,
      subject: params.subject,
      text: params.message,
    });
  }
}
