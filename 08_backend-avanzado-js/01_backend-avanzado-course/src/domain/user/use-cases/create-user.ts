import { BusinessConflictError } from '../../errors/BusinessConflictError';
import { QueueService } from '../../shared/QueueService';
import { UserRepository } from '../repositories/UserRepository';
import { SecurityService } from '../services/SecurityService';
import { User } from '../User';

export interface CreateUserUseCaseInput {
  email: string;
  password: string;
  name: string;
  surname: string;
}

export class CreateUserUseCase {
  private readonly userRepository: UserRepository;
  private readonly securityService: SecurityService;
  private readonly queueService: QueueService;

  constructor(
    userRepository: UserRepository,
    securityService: SecurityService,
    queueService: QueueService,
  ) {
    this.userRepository = userRepository;
    this.securityService = securityService;
    this.queueService = queueService;
  }

  async execute(input: CreateUserUseCaseInput): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(input.email);

    if (existingUser) {
      throw new BusinessConflictError('An user with same email already exists');
    }

    this.validatePassword(input.password);

    this.validateEmail(input.email);

    const hashedPassword = await this.securityService.hash(input.password);

    const newUser = await this.userRepository.create({ ...input, password: hashedPassword });

    this.queueService.sendWelcomeEmail({ email: newUser.email, name: newUser.name });

    return newUser;
  }

  private validatePassword(password: string) {
    const passwordRegExp = new RegExp(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,20}$/);

    if (!passwordRegExp.test(password)) {
      throw new Error('PW_INVALID'); // BadSyntaxError
    }
  }

  private validateEmail(email: string) {
    const emailRegExp = new RegExp(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

    if (!emailRegExp.test(email)) {
      throw new Error('EMAIL_INVALID'); // BadSyntaxError
    }
  }
}
