import { CreateUserUseCaseInput } from '../use-cases/create-user';
import { User } from '../User';

export interface UserRepository {
  findByEmail: (email: string) => Promise<User | null>;
  create: (params: CreateUserUseCaseInput) => Promise<User>;
  findById: (id: number) => Promise<User | null>;
  remove: (id: number) => Promise<void>;
}
