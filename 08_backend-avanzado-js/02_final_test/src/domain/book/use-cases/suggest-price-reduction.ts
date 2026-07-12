import { EmailService } from '../../shared/EmailService';
import { UserRepository } from '../../user/repositories/UserRepository';
import { BookRepository } from '../repositories/BookRepository';

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

export class SuggestPriceReductionUseCase {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
  ) {}

  // tarea semanal: localiza los libros PUBLISHED con más de 7 días
  // publicados y envía un email al propietario sugiriendo bajar el precio
  async execute(): Promise<number> {
    const threshold = new Date(Date.now() - SEVEN_DAYS_IN_MS);

    const staleBooks = await this.bookRepository.findPublishedOlderThan(threshold);

    for (const book of staleBooks) {
      const owner = await this.userRepository.findById(book.ownerId);

      if (!owner) {
        continue;
      }

      await this.emailService.send({
        email: owner.email,
        subject: `Tu libro "${book.title}" sigue sin venderse`,
        message:
          `Hola, tu libro "${book.title}" lleva publicado más de 7 días ` +
          `con un precio de ${book.price} €. Te sugerimos revisar la publicación ` +
          `o bajar el precio para aumentar las posibilidades de venta.`,
      });
    }

    return staleBooks.length;
  }
}
