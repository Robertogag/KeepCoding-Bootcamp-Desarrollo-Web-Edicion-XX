'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Field, inputClasses, Select } from '@/components/form/Field';
import { FormAlert } from '@/components/form/FormAlert';
import { useErrorMessage } from '@/components/state/errorMessage';
import { PendingButton } from '@/components/state/PendingButton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { listDowntimeReasons, updateEvent } from '@/lib/api/oee';
import type { MachineEvent } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';

interface ClassifyEventDialogProps {
  event: MachineEvent;
  onClose: () => void;
}

export function ClassifyEventDialog({ event, onClose }: ClassifyEventDialogProps) {
  const t = useTranslations('events');
  const tc = useTranslations('common');
  const locale = useLocale();
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reasonCode, setReasonCode] = useState(event.reason_code ?? '');
  const [comment, setComment] = useState(event.comment ?? '');
  const [alert, setAlert] = useState<string | null>(null);

  const reasons = useQuery({
    queryKey: queryKeys.reasons,
    queryFn: listDowntimeReasons,
    staleTime: 10 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      updateEvent(event.id, {
        reason_code: reasonCode || null,
        comment: comment.trim() || null,
      }),
    onSuccess: async () => {
      toast({ title: t('saved'), variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['machines', event.machine_id, 'events'] });
      onClose();
    },
    onError: (error) => setAlert(describe(error)),
  });

  function close() {
    if (!mutation.isPending) onClose();
  }

  return (
    <Modal
      open
      onClose={close}
      title={t('classifyTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={mutation.isPending}>
            {tc('cancel')}
          </Button>
          <PendingButton pending={mutation.isPending} onClick={() => mutation.mutate()}>
            {t('save')}
          </PendingButton>
        </>
      }
    >
      <div className="space-y-4 text-fg">
        <FormAlert message={alert} />
        <Field label={t('reasonLabel')} htmlFor="event-reason">
          <Select
            id="event-reason"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            disabled={reasons.isPending}
          >
            <option value="">{t('noReason')}</option>
            {[...(reasons.data?.items ?? [])]
              .sort((a, b) => Number(a.code) - Number(b.code))
              .map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.code} · {locale === 'en' ? reason.label_en : reason.label_es}
                </option>
              ))}
          </Select>
        </Field>
        <Field label={t('commentLabel')} htmlFor="event-comment">
          <textarea
            id="event-comment"
            value={comment}
            maxLength={500}
            rows={3}
            onChange={(e) => setComment(e.target.value)}
            className={`${inputClasses} h-auto py-2`}
          />
        </Field>
      </div>
    </Modal>
  );
}
