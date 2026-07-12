import { UserRepository } from '../../../domain/user/repositories/UserRepository';
import { CreateUserUseCaseInput } from '../../../domain/user/use-cases/create-user';
import { User } from '../../../domain/user/User';
// Importamos la instancia compartida de PrismaClient en lugar de crear una nueva cada vez.
// Esto evita problemas de múltiples pools de conexión y condiciones de carrera.
import { prisma } from '../../prisma-client';

type PrismaUser = {
  id: number;
  email: string;
  password: string;
  name: string;
  surname: string;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaUserRepository implements UserRepository {
  private readonly prisma = prisma;

  async findByEmail(email: string): Promise<User | null> {
    const prismaUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!prismaUser) {
      return null;
    } else {
      return this.restore(prismaUser);
    }
  }

  async create(params: CreateUserUseCaseInput): Promise<User> {
    const newUser = await this.prisma.user.create({
      data: {
        name: params.name,
        email: params.email,
        password: params.password,
        surname: params.surname,
      },
    });

    return this.restore(newUser);
  }

  async findById(userId: number) {
    const prismaUser = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!prismaUser) {
      return null;
    } else {
      return this.restore(prismaUser);
    }
  }

  async remove(id: number): Promise<void> {
    await this.prisma.user.delete({
      where: {
        id,
      },
    });
  }

  private restore(prismaUser: PrismaUser): User {
    return new User({
      id: prismaUser.id,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
      email: prismaUser.email,
      name: prismaUser.name,
      surname: prismaUser.surname,
      password: prismaUser.password,
    });
  }
}
