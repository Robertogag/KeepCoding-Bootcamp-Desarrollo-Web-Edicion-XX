export abstract class DomainEvent {
  abstract readonly name: string;
  readonly occurredAt: Date;

  constructor() {
    this.occurredAt = new Date();
  }
}
