import { z } from 'zod';

export type Translate = (key: string) => string;

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const LETTER = /[A-Za-z]/;
const DIGIT = /[0-9]/;

export function passwordSchema(t: Translate) {
  return z
    .string()
    .min(8, t('password'))
    .max(128, t('password'))
    .refine((value) => LETTER.test(value) && DIGIT.test(value), t('password'));
}

export function usernameSchema(t: Translate) {
  return z.string().regex(USERNAME_PATTERN, t('username'));
}

export function emailSchema(t: Translate) {
  return z.email(t('email')).max(254, t('email'));
}

export function registerSchema(t: Translate) {
  return z.object({
    username: usernameSchema(t),
    email: emailSchema(t),
    full_name: z.string().trim().min(2, t('fullName')).max(80, t('fullName')),
    password: passwordSchema(t),
    language: z.enum(['es', 'en'], t('language')),
  });
}

export function loginSchema(t: Translate) {
  return z.object({
    username: z.string().trim().min(1, t('required')),
    password: z.string().min(1, t('required')),
  });
}

export function forgotPasswordSchema(t: Translate) {
  return z.object({ email: emailSchema(t) });
}

export function resetPasswordSchema(t: Translate) {
  return z
    .object({
      password: passwordSchema(t),
      confirm: z.string(),
    })
    .refine((value) => value.password === value.confirm, {
      path: ['confirm'],
      error: t('passwordConfirm'),
    });
}

export function profileSchema(t: Translate) {
  return z.object({
    username: usernameSchema(t),
    email: emailSchema(t),
    full_name: z.string().trim().min(2, t('fullName')).max(80, t('fullName')),
    language: z.enum(['es', 'en'], t('language')),
  });
}

export function changePasswordSchema(t: Translate) {
  return z
    .object({
      current_password: z.string().min(1, t('required')),
      password: passwordSchema(t),
      confirm: z.string(),
    })
    .refine((value) => value.password === value.confirm, {
      path: ['confirm'],
      error: t('passwordConfirm'),
    });
}

export function deleteAccountSchema(t: Translate) {
  return z.object({ password: z.string().min(1, t('required')) });
}

export type RegisterInput = z.infer<ReturnType<typeof registerSchema>>;
export type LoginInput = z.infer<ReturnType<typeof loginSchema>>;
export type ForgotPasswordInput = z.infer<ReturnType<typeof forgotPasswordSchema>>;
export type ResetPasswordInput = z.infer<ReturnType<typeof resetPasswordSchema>>;
export type ProfileInput = z.infer<ReturnType<typeof profileSchema>>;
export type ChangePasswordInput = z.infer<ReturnType<typeof changePasswordSchema>>;
export type DeleteAccountInput = z.infer<ReturnType<typeof deleteAccountSchema>>;
