import React from 'react';
import { clsx } from 'clsx';

export default function Input({ label, error, className, hint, ...props }) {
  return (
    <div className="w-full">
      {label && (
        <label className="field-label">
          {label}
          {props.required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <input className={clsx('input-field', error && '!border-red-500', className)} {...props} />
      {error ? (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  );
}
