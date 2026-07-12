export interface QueueService {
  sendWelcomeEmail: (params: { email: string; name: string }) => void;
  sendProductCreatedEmail: (params: { userId: string; productName: string }) => void;
}
