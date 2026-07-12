import { DomainEvent } from '../../domain/shared/DomainEvent';
import { EventBus } from '../../domain/shared/EventBus';
import { EventEmitter } from 'events';

class NodeEventBus implements EventBus {
  private readonly eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  publish(event: DomainEvent): void {
    this.eventEmitter.emit(event.name, event);
  }
  subscribe(eventName: string, handler: (event: DomainEvent) => Promise<void>): void {
    this.eventEmitter.on(eventName, handler);
  }
}

export const nodeEventBus = new NodeEventBus();
