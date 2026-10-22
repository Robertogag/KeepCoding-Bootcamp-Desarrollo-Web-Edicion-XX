import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/state/EmptyState';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export interface CatalogColumn<T> {
  key: string;
  label: string;
  render: (item: T) => ReactNode;
  align?: 'right';
  hideOnMobile?: boolean;
  numeric?: boolean;
}

interface CatalogTableProps<T> {
  items: T[];
  columns: CatalogColumn<T>[];
  onEdit?: (item: T) => void;
  emptyTitle: string;
  emptyText?: string;
  caption?: string;
}

export function CatalogTable<T extends { id: number; is_active?: boolean }>({
  items,
  columns,
  onEdit,
  emptyTitle,
  emptyText,
  caption,
}: CatalogTableProps<T>) {
  const t = useTranslations('catalogs');
  if (items.length === 0) return <EmptyState title={emptyTitle} text={emptyText} />;

  return (
    <>
      <div className="panel hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          {caption ? <caption className="eyebrow px-3 py-2 text-left">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn('px-3 py-2 font-medium', column.align === 'right' && 'text-right')}
                >
                  {column.label}
                </th>
              ))}
              {onEdit ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={cn('border-b border-line/60', item.is_active === false && 'text-muted')}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 py-2 align-top',
                      column.align === 'right' && 'text-right',
                      column.numeric && 'numeric',
                    )}
                  >
                    {column.render(item)}
                  </td>
                ))}
                {onEdit ? (
                  <td className="px-3 py-1.5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                      {t('edit')}
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {items.map((item) => (
          <li key={item.id} className={cn('panel p-3', item.is_active === false && 'text-muted')}>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="eyebrow">{column.label}</dt>
                    <dd className={cn('truncate', column.numeric && 'numeric')}>
                      {column.render(item)}
                    </dd>
                  </div>
                ))}
            </dl>
            {onEdit ? (
              <div className="mt-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                  {t('edit')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
