import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="hidden sm:block px-6 py-3 border-t border-gray-200/80 dark:border-white/5 bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm">
      <div className="flex flex-row items-center justify-center gap-6">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          FRAGMENTLY-API &copy; {new Date().getFullYear()} — Telegram Stars va Premium API Platformasi
        </p>
        <div className="flex items-center gap-4">
          <Link to="/terms" className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition">
            Foydalanish shartlari
          </Link>
          <Link to="/help" className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition">
            Yordam
          </Link>
        </div>
      </div>
    </footer>
  );
}