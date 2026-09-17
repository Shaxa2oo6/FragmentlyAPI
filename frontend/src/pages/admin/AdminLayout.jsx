import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  HomeIcon,
  UsersIcon,
  ArrowPathIcon,
  SparklesIcon,
  HeartIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const adminTabs = [
  { to: '/admin', icon: HomeIcon, labelKey: 'alOverview', end: true },
  { to: '/admin/users', icon: UsersIcon, labelKey: 'alUsers' },
  { to: '/admin/transactions', icon: ArrowPathIcon, labelKey: 'alTransactions' },
  { to: '/admin/tariffs', icon: SparklesIcon, labelKey: 'alTariffs' },
  { to: '/admin/health', icon: HeartIcon, labelKey: 'alHealth' },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      {/* Admin sub-navigation */}
      <div className="card p-2">
        <div className="flex flex-wrap items-center gap-1">
          <NavLink
            to="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition min-h-[38px]"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            {t('alBackToApp')}
          </NavLink>
          <div className="flex-1" />
          {adminTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition min-h-[38px] ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20 font-bold'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span>{t(tab.labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
        {t('alPanelTitle')} · <span className="font-mono font-bold text-gray-700 dark:text-gray-200">{user?.username}</span> ({user?.role})
      </div>

      <Outlet />
    </div>
  );
}
