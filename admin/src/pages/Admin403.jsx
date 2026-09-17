import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldExclamationIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export default function Admin403() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20 shadow-inner">
          <ShieldExclamationIcon className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            HTTP 403 FORBIDDEN
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Ruxsat Etilmadi</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Sizning hisobingiz <strong>FRAGMENTLY-API Admin Console</strong> bo'limiga kirish huquqiga ega emas. Faqat maxsus admin rollari ruxsat etilgan.
          </p>
        </div>

        <div className="pt-2">
          <Link
            to="/admin/login"
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 min-h-[44px]"
          >
            <LockClosedIcon className="w-4 h-4" />
            Admin Login Sahifasiga O'tish
          </Link>
        </div>
      </div>
    </div>
  );
}
