import { DomainError } from './DomainError';

export class EntityNotFoundError extends DomainError {
  readonly name = 'EntityNotFoundError';

  constructor(entity: string, id: string) {
    super(`entity ${entity} not found with id ${id}`);
  }
}
