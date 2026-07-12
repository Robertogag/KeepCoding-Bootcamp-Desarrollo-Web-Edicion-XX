export interface SecurityService {
  hash(value: string): Promise<string>;
  comparePasswords(pw1: string, pw2: string): Promise<boolean>;
  generateJwt(userId: number): string;
  verifyJwt(token: string): { iat: number; userId: number } | null;
}
