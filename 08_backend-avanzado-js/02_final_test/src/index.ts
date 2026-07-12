import cron from 'node-cron';
import { api } from './api';
import { BookSoldEvent } from './domain/book/events/BookSoldEvent';
import { SuggestPriceReductionUseCase } from './domain/book/use-cases/suggest-price-reduction';
import { environmentService } from './infrastructure/EnvironmentService';
import { PrismaBookRepository } from './infrastructure/book/repositories/PrismaBookRepository';
import { nodeEventBus } from './infrastructure/shared/NodeEventBus';
import { NodemailerEmailService } from './infrastructure/shared/NodemailerEmailService';
import { PrismaUserRepository } from './infrastructure/user/repositories/PrismaUserRepository';

environmentService.load();

const { PORT } = environmentService.get();

api.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Notificación de venta: cuando se completa una compra, el use-case
// publica un BookSoldEvent y aquí se envía el email al vendedor.
nodeEventBus.subscribe('book.sold', async (event) => {
  const bookSoldEvent = event as BookSoldEvent;

  try {
    const userRepository = new PrismaUserRepository();
    const owner = await userRepository.findById(bookSoldEvent.ownerId);

    if (!owner) {
      return;
    }

    const emailService = new NodemailerEmailService();
    await emailService.send({
      email: owner.email,
      subject: `¡Has vendido "${bookSoldEvent.title}"!`,
      message:
        `Enhorabuena, tu libro "${bookSoldEvent.title}" se ha vendido ` +
        `por ${bookSoldEvent.price} € el ${bookSoldEvent.soldAt.toLocaleString()}.`,
    });

    console.log(`Email de venta enviado al vendedor ${owner.email}`);
  } catch (error) {
    // el fallo del email no debe romper la compra ya completada
    console.error('Error enviando el email de venta:', error);
  }
});

// Tarea programada semanal (lunes 09:00): sugerencia de bajada de precio
// para libros PUBLISHED con más de 7 días publicados.
cron.schedule('0 9 * * 1', async () => {
  console.log('Ejecutando tarea semanal: sugerencia de bajada de precio');

  try {
    const suggestPriceReductionUseCase = new SuggestPriceReductionUseCase(
      new PrismaBookRepository(),
      new PrismaUserRepository(),
      new NodemailerEmailService(),
    );

    const notifiedBooks = await suggestPriceReductionUseCase.execute();

    console.log(`Tarea semanal completada: ${notifiedBooks} emails de sugerencia enviados`);
  } catch (error) {
    console.error('Error en la tarea semanal de sugerencia de precio:', error);
  }
});
