import { EntityNotFoundError } from '../../errors/EntityNotFoundError';
import { EventBus } from '../../shared/EventBus';
import { UserRemovedEvent } from '../events/UserRemovedEvent';
import { UserRepository } from '../repositories/UserRepository';

export class RemoveUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(userId: number): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new EntityNotFoundError('User', userId.toString());
    }

    // await this.userRepository.remove(userId);

    const userRemovedEvent = new UserRemovedEvent(userId);
    this.eventBus.publish(userRemovedEvent);
  }
}
