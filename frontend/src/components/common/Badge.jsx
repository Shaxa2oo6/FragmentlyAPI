import React from 'react';
import { clsx } from 'clsx';

const tones = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  accent: 'badge-accent',
  neutral: 'badge-neutral',
};

export default function Badge({
  tone = 'neutral',
  dot = false,
  className,
  children,
  ...props
}) {
  return (
    <span
      className={clsx('badge', tones[tone], dot && 'badge-dot', className)}
      {...props}
    >
      {children}
    </span>
  );
}
