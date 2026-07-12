import { DomainEvent } from '../../shared/DomainEvent';

export class BookSoldEvent extends DomainEvent {
  readonly name: string = 'book.sold';
  readonly bookId: number;
  readonly title: string;
  readonly price: number;
  readonly ownerId: number;
  readonly soldAt: Date;

  constructor(params: {
    bookId: number;
    title: string;
    price: number;
    ownerId: number;
    soldAt: Date;
  }) {
    super();

    this.bookId = params.bookId;
    this.title = params.title;
    this.price = params.price;
    this.ownerId = params.ownerId;
    this.soldAt = params.soldAt;
  }
}
