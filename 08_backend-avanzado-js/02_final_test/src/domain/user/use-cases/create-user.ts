import { BusinessConflictError } from '../../errors/BusinessConflictError';
import { UserRepository } from '../repositories/UserRepository';
import { SecurityService } from '../services/SecurityService';
import { User } from '../User';

export interface CreateUserUseCaseInput {
  email: string;
  password: string;
}

export class CreateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly securityService: SecurityService,
  ) {}

  async execute(input: CreateUserUseCaseInput): Promise<User> {
    // regla de negocio: el email debe ser único
    const existingUser = await this.userRepository.findByEmail(input.email);

    if (existingUser) {
      throw new BusinessConflictError('An user with same email already exists');
    }

    // regla de negocio: la contraseña se almacena siempre hasheada
    const hashedPassword = await this.securityService.hash(input.password);

    const newUser = await this.userRepository.create({
      email: input.email,
      password: hashedPassword,
    });

    return newUser;
  }
}
