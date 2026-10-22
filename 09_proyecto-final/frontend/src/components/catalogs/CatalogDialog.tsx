'use client';

import { useTranslations } from 'next-intl';
import type { FormEvent, ReactNode } from 'react';
import { FormAlert } from '@/components/form/FormAlert';
import { PendingButton } from '@/components/state/PendingButton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface CatalogDialogProps {
  title: string;
  formId: string;
  pending: boolean;
  alert: string | null;
  saveLabel: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

// Cascarón común de los diálogos de catálogo: modal, formulario, aviso y botones.
export function CatalogDialog({
  title,
  formId,
  pending,
  alert,
  saveLabel,
  onClose,
  onSubmit,
  children,
}: CatalogDialogProps) {
  const tc = useTranslations('common');
  function close() {
    if (!pending) onClose();
  }
  return (
    <Modal
      open
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={pending}>
            {tc('cancel')}
          </Button>
          <PendingButton type="submit" form={formId} pending={pending}>
            {saveLabel}
          </PendingButton>
        </>
      }
    >
      <form id={formId} noValidate className="space-y-4 text-fg" onSubmit={onSubmit}>
        <FormAlert message={alert} />
        {children}
      </form>
    </Modal>
  );
}
