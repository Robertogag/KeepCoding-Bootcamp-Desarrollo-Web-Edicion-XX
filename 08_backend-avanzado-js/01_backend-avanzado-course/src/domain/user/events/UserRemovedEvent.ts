import { DomainEvent } from '../../shared/DomainEvent';

export class UserRemovedEvent extends DomainEvent {
  readonly name: string = 'user.removed';
  readonly userId: number;

  constructor(userId: number) {
    super();

    this.userId = userId;
  }
}
