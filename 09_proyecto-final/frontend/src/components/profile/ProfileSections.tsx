'use client';

import { useSession } from '@/lib/auth/useSession';
import { DeleteAccount } from './DeleteAccount';
import { PasswordForm } from './PasswordForm';
import { ProfileForm } from './ProfileForm';

export function ProfileSections() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <div className="space-y-6">
      <ProfileForm user={user} />
      <PasswordForm />
      <DeleteAccount />
    </div>
  );
}
