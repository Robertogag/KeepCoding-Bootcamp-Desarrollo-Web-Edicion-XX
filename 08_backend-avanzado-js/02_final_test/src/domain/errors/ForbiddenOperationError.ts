import { DomainError } from './DomainError';

export class ForbiddenOperationError extends DomainError {
  readonly name = 'ForbiddenOperationError';

  constructor(message: string) {
    super(message);
  }
}
