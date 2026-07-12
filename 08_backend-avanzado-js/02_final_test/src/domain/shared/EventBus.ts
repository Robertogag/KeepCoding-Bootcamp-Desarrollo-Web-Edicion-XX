import { DomainEvent } from './DomainEvent';

export interface EventBus {
  publish(event: DomainEvent): void;
  subscribe(eventName: string, handler: (event: DomainEvent) => Promise<void>): void;
}
