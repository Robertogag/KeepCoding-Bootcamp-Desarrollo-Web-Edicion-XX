import { BusinessConflictError } from '../../errors/BusinessConflictError';
import { EntityNotFoundError } from '../../errors/EntityNotFoundError';
import { ForbiddenOperationError } from '../../errors/ForbiddenOperationError';
import { EventBus } from '../../shared/EventBus';
import { Book } from '../Book';
import { BookSoldEvent } from '../events/BookSoldEvent';
import { BookRepository } from '../repositories/BookRepository';

export interface BuyBookUseCaseInput {
  bookId: number;
  buyerId: number;
}

export class BuyBookUseCase {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: BuyBookUseCaseInput): Promise<Book> {
    const book = await this.bookRepository.findById(input.bookId);

    // validación: el libro debe existir
    if (!book) {
      throw new EntityNotFoundError('Book', input.bookId.toString());
    }

    // regla de negocio: un libro vendido no puede volver a comprarse
    if (book.status !== 'PUBLISHED') {
      throw new BusinessConflictError('El libro ya ha sido vendido');
    }

    // regla de negocio: un usuario no puede comprar sus propios libros
    if (book.ownerId === input.buyerId) {
      throw new ForbiddenOperationError('No puedes comprar tu propio libro');
    }

    // la compra marca el libro como SOLD y registra la fecha de venta.
    // markAsSold solo actualiza si el libro sigue PUBLISHED, para evitar
    // que dos compras simultáneas vendan el mismo libro dos veces.
    const soldBook = await this.bookRepository.markAsSold(input.bookId, new Date());

    if (!soldBook) {
      throw new BusinessConflictError('El libro ya ha sido vendido');
    }

    // se notifica la venta al vendedor por email (vía evento de dominio,
    // el suscriptor es quien conoce el servicio de email)
    this.eventBus.publish(
      new BookSoldEvent({
        bookId: soldBook.id,
        title: soldBook.title,
        price: soldBook.price,
        ownerId: soldBook.ownerId,
        soldAt: soldBook.soldAt ?? new Date(),
      }),
    );

    return soldBook;
  }
}
