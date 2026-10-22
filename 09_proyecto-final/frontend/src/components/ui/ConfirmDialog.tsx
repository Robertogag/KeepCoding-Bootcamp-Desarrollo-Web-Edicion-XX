'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { PendingButton } from '@/components/state/PendingButton';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmLabel: string;
  children?: ReactNode;
  pending?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  confirmLabel,
  children,
  pending = false,
  disabled = false,
  danger = false,
}: ConfirmDialogProps) {
  const t = useTranslations('common');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t('cancel')}
          </Button>
          <PendingButton
            variant={danger ? 'danger' : 'primary'}
            pending={pending}
            disabled={disabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </PendingButton>
        </>
      }
    >
      {children}
    </Modal>
  );
}
