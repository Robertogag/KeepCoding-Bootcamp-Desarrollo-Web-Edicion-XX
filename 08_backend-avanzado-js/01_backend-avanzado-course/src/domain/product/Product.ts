import { Entity, EntityProps } from '../shared/Entity';

interface PartialProductProps {
  name: string;
  description: string;
  price: number;
  userId: number;
}

type ProductProps = PartialProductProps & EntityProps;

export class Product extends Entity {
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly userId: number;

  constructor(props: ProductProps) {
    super({ id: props.id, createdAt: props.createdAt, updatedAt: props.updatedAt });

    this.name = props.name;
    this.description = props.description;
    this.price = props.price;
    this.userId = props.userId;
  }
}
