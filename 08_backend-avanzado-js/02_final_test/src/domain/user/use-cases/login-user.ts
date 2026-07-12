import { EntityNotFoundError } from '../../errors/EntityNotFoundError';
import { UnauthorizedError } from '../../errors/UnauthorizedError';
import { UserRepository } from '../repositories/UserRepository';
import { SecurityService } from '../services/SecurityService';

interface LoginUserUseCaseInput {
  email: string;
  password: string;
}

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly securityService: SecurityService,
  ) {}

  async execute(input: LoginUserUseCaseInput): Promise<string> {
    const user = await this.userRepository.findByEmail(input.email);

    if (!user) {
      throw new EntityNotFoundError('User', input.email);
    }

    const isMatch = await this.securityService.comparePasswords(input.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedError('Wrong password');
    }

    const token = this.securityService.generateJwt(user.id);

    return token;
  }
}
