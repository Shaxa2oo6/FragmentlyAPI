import React from 'react';
import { clsx } from 'clsx';

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
};

const sizes = {
  sm: '!min-h-[36px] px-3 text-xs',
  md: 'px-4 text-sm',
  lg: 'px-6 min-h-[48px] text-sm',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) {
  return (
    <button
      className={clsx('btn press-scale', variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
