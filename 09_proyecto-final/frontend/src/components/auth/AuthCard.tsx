import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="panel p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
      {footer ? (
        <div className="mt-6 border-t border-line pt-4 text-sm text-muted">{footer}</div>
      ) : null}
    </div>
  );
}
