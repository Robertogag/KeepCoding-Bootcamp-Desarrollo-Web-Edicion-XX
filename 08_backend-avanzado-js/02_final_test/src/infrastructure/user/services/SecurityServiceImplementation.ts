import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { SecurityService } from '../../../domain/user/services/SecurityService';
import { environmentService } from '../../EnvironmentService';

export class SecurityServiceImplementation implements SecurityService {
  private readonly SECRET_KEY: string;

  constructor() {
    this.SECRET_KEY = environmentService.get().JWT_SECRET;
  }

  async hash(value: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(value, salt);

    return hashedPassword;
  }

  comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  generateJwt(userId: number): string {
    const token = jwt.sign({ userId }, this.SECRET_KEY);

    return token;
  }

  verifyJwt(token: string): { iat: number; userId: number } | null {
    try {
      const decodedToken = jwt.verify(token, this.SECRET_KEY);
      return decodedToken as { iat: number; userId: number };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return null;
    }
  }
}
