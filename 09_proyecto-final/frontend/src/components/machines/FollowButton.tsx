'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/components/state/errorMessage';
import { PendingButton } from '@/components/state/PendingButton';
import { IconStar } from '@/components/ui/icons';
import { useToast } from '@/components/ui/Toast';
import type { Machine } from '@/lib/api/types';
import { followMachine, unfollowMachine } from '@/lib/api/watchlist';
import { queryKeys } from '@/lib/query/keys';

export function FollowButton({ machine }: { machine: Machine }) {
  const t = useTranslations('follow');
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = queryKeys.machines.detail(machine.id);

  const mutation = useMutation({
    mutationFn: (watched: boolean) =>
      watched ? unfollowMachine(machine.id) : followMachine(machine.id),
    onMutate: async (watched) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Machine>(key);
      queryClient.setQueryData<Machine>(key, (current) =>
        current ? { ...current, is_watched: !watched } : current,
      );
      return { previous };
    },
    onError: (error, _watched, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast({ title: describe(error), variant: 'error' });
    },
    onSuccess: (_data, watched) => {
      toast({
        title: watched
          ? t('unfollowed', { name: machine.name })
          : t('followed', { name: machine.name }),
        variant: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
    },
  });

  return (
    <PendingButton
      variant={machine.is_watched ? 'secondary' : 'primary'}
      size="sm"
      pending={mutation.isPending}
      onClick={() => mutation.mutate(machine.is_watched)}
      aria-pressed={machine.is_watched}
      title={t('hint')}
    >
      <IconStar className="size-4" fill={machine.is_watched ? 'currentColor' : 'none'} />
      {machine.is_watched ? t('unfollow') : t('follow')}
    </PendingButton>
  );
}
