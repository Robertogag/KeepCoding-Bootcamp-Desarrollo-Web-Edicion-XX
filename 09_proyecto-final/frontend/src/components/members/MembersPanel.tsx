'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Input, Select } from '@/components/form/Field';
import { FormAlert } from '@/components/form/FormAlert';
import { usePlant } from '@/components/plants/PlantContext';
import { EmptyState } from '@/components/state/EmptyState';
import { useErrorMessage } from '@/components/state/errorMessage';
import { PendingButton } from '@/components/state/PendingButton';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from '@/i18n/navigation';
import { addMember, removeMember, updateMemberRole } from '@/lib/api/members';
import { listMembers } from '@/lib/api/plants';
import type { Member, PlantRole } from '@/lib/api/types';
import { useSession } from '@/lib/auth/useSession';
import { queryKeys } from '@/lib/query/keys';
import { resetQueryClient } from '@/lib/query/provider';
import { EmployeesSection } from './EmployeesSection';

const ROLES: PlantRole[] = ['owner', 'supervisor', 'viewer'];

export function MembersPanel() {
  const { plant, isOwner } = usePlant();
  const t = useTranslations('members');
  const tr = useTranslations('app.role');
  const describe = useErrorMessage();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<PlantRole>('viewer');
  const [alert, setAlert] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  const query = useQuery({
    queryKey: queryKeys.plants.members(plant.id),
    queryFn: () => listMembers(plant.id),
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.plants.members(plant.id) });

  const add = useMutation({
    mutationFn: () => addMember(plant.id, username.trim(), role),
    onSuccess: async () => {
      setUsername('');
      setAlert(null);
      toast({ title: t('added'), variant: 'success' });
      await invalidate();
    },
    onError: (error) => setAlert(describe(error)),
  });

  const changeRole = useMutation({
    mutationFn: ({ member, next }: { member: Member; next: PlantRole }) =>
      updateMemberRole(plant.id, member.user_id, next),
    onSuccess: async (updated) => {
      toast({ title: t('roleChanged'), variant: 'success' });
      await invalidate();
      if (updated.user_id === user?.id)
        await queryClient.invalidateQueries({ queryKey: queryKeys.plants.all });
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });

  const remove = useMutation({
    mutationFn: (member: Member) => removeMember(plant.id, member.user_id),
    onSuccess: async (_data, member) => {
      setRemoving(null);
      toast({ title: t('removed'), variant: 'success' });
      if (member.user_id === user?.id) {
        resetQueryClient();
        router.replace('/app');
        return;
      }
      await invalidate();
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t('subtitle')}</p>
      </div>

      {isOwner ? (
        <form
          className="flex flex-wrap items-end gap-2 panel p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (username.trim()) add.mutate();
          }}
        >
          <label className="min-w-0 flex-1 text-sm text-muted sm:max-w-xs">
            {t('username')}
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoCapitalize="none"
              spellCheck={false}
              className="mt-1"
            />
          </label>
          <label className="text-sm text-muted">
            {t('role')}
            <Select
              value={role}
              onChange={(event) => setRole(event.target.value as PlantRole)}
              className="mt-1 w-auto"
            >
              {ROLES.map((item) => (
                <option key={item} value={item}>
                  {tr(item)}
                </option>
              ))}
            </Select>
          </label>
          <PendingButton
            type="submit"
            size="md"
            pending={add.isPending}
            disabled={!username.trim()}
          >
            {t('add')}
          </PendingButton>
          <FormAlert message={alert} className="basis-full" />
        </form>
      ) : null}

      <QueryState
        query={query}
        skeleton={
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        }
        isEmpty={(data) => data.items.length === 0}
        empty={<EmptyState title={t('emptyTitle')} />}
      >
        {(data) => (
          <ul className="divide-y divide-line panel">
            {data.items.map((member) => {
              const isSelf = member.user_id === user?.id;
              return (
                <li key={member.user_id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {member.full_name}
                      {isSelf ? <span className="ml-2 text-xs text-muted">{t('you')}</span> : null}
                    </p>
                    <p className="text-sm text-muted">@{member.username}</p>
                  </div>
                  {isOwner ? (
                    <label className="text-sm text-muted">
                      <span className="sr-only">{t('role')}</span>
                      <Select
                        value={member.role}
                        disabled={changeRole.isPending}
                        onChange={(event) =>
                          changeRole.mutate({ member, next: event.target.value as PlantRole })
                        }
                        className="w-auto"
                      >
                        {ROLES.map((item) => (
                          <option key={item} value={item}>
                            {tr(item)}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : (
                    <span className="text-sm font-medium">{tr(member.role)}</span>
                  )}
                  {isOwner ? (
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(member)}>
                      {t('remove.button')}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => !remove.isPending && setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing)}
        title={t('remove.title', { name: removing?.full_name ?? '' })}
        confirmLabel={t('remove.confirm')}
        pending={remove.isPending}
        danger
      >
        <p>{removing?.user_id === user?.id ? t('remove.selfText') : t('remove.text')}</p>
      </ConfirmDialog>
      <EmployeesSection />
    </div>
  );
}
