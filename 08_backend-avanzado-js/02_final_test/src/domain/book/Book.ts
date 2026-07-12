import { Entity, EntityProps } from '../shared/Entity';

export type BookStatus = 'PUBLISHED' | 'SOLD';

interface PartialBookProps {
  title: string;
  description: string;
  price: number;
  author: string;
  status: BookStatus;
  soldAt: Date | null;
  ownerId: number;
}

type BookProps = PartialBookProps & EntityProps;

export class Book extends Entity {
  readonly title: string;
  readonly description: string;
  readonly price: number;
  readonly author: string;
  readonly status: BookStatus;
  readonly soldAt: Date | null;
  readonly ownerId: number;

  constructor(props: BookProps) {
    super({ id: props.id, createdAt: props.createdAt, updatedAt: props.updatedAt });

    this.title = props.title;
    this.description = props.description;
    this.price = props.price;
    this.author = props.author;
    this.status = props.status;
    this.soldAt = props.soldAt;
    this.ownerId = props.ownerId;
  }
}
