import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-panel-2', className)} />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('panel p-4', className)}>
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <div className="mt-4 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index}>
            <Skeleton className="h-3 w-6" />
            <Skeleton className="mt-1 h-6 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-4 h-8 w-28" />
    </div>
  );
}

export function SkeletonCardGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
