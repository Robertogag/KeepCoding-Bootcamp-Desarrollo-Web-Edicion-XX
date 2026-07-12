export interface EntityProps {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Entity {
  readonly id: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: EntityProps) {
    this.id = props.id;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
