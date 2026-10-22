'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
}

// <dialog> nativo: atrapa el foco, cierra con Escape y bloquea el fondo sin librerías.
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md panel p-0 text-fg shadow-xl backdrop:bg-black/60"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {children ? <div className="mt-3 space-y-3 text-sm text-muted">{children}</div> : null}
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </dialog>
  );
}
