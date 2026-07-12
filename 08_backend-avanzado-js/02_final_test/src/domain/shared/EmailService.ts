export interface EmailService {
  send: (params: { email: string; message: string; subject?: string }) => Promise<void>;
}
