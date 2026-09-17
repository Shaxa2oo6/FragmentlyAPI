import React from 'react';
import { clsx } from 'clsx';

export default function Skeleton({ className }) {
  return <div className={clsx('skeleton', className)} aria-hidden="true" />;
}

export function CardSkeleton({ rows = 3, className }) {
  return (
    <div className={clsx('card p-5 space-y-3', className)}>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-3.5 w-full" />
      ))}
    </div>
  );
}
