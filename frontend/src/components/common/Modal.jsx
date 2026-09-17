import React from 'react';
import { clsx } from 'clsx';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Modal({
  open,
  onClose,
  title,
  children,
  className,
  hideClose = false,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — to'liq ekranni qoplaydi */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className={clsx(
          'relative w-full sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl',
          'rounded-2xl',
          'p-5 sm:p-6',
          'max-h-[90vh] overflow-y-auto',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            {!hideClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
