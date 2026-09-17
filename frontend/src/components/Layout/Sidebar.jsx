import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  BarChart3,
  ArrowLeftRight,
  FileCode2,
  User,
  CreditCard,
  KeyRound,
  Lock,
  FileText,
  Sun,
  Moon,
  LogOut,
  X,
  Star,
} from 'lucide-react';

function SidebarContent({ onClose }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  const mainNavItems = [
    { to: '/dashboard', icon: BarChart3, label: t('navDashboard') },
    { to: '/transactions', icon: ArrowLeftRight, label: t('navTransactions') },
    { to: '/api-docs', icon: FileCode2, label: t('navApiDocs') },
  ];

  // Determine if user logged in via Google Auth (no password change menu needed)
  const isGoogleAuth = Boolean(
    user?.provider === 'google' ||
      user?.auth_provider === 'google' ||
      user?.is_google ||
      (user?.picture && !user?.has_password)
  );

  const accountNavItems = [
    { to: '/profile', icon: User, label: t('navProfile') },
    { to: '/subscriptions', icon: CreditCard, label: t('navSubscriptions') },
    { to: '/mnemonic', icon: KeyRound, label: t('navMnemonic') },
    // Only show password change if not a Google Auth user
    ...(!isGoogleAuth ? [{ to: '/settings', icon: Lock, label: t('navSettings') }] : []),
  ];

  return (
    <div className="flex flex-col h-full select-none">
      {/* Top Logo */}
      <div className="px-5 py-5 flex items-center justify-between border-b border-gray-100 dark:border-slate-800/60 shrink-0">
        <NavLink to="/dashboard" onClick={onClose} className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0D9488] via-[#14B8A6] to-[#2DD4BF] text-white flex items-center justify-center shadow-lg shadow-[#0D9488]/30 group-hover:scale-105 transition-transform duration-200 shrink-0">
            <Star className="w-5 h-5 fill-white/20 stroke-white stroke-[2.2]" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white font-sans">
            FRAGMENTLY-API
          </span>
        </NavLink>

        <button
          type="button"
          onClick={onClose}
          className="lg:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg transition-colors"
          aria-label="Menyuni yopish"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {/* ASOSIY Section */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold tracking-wider text-gray-400 dark:text-slate-400 uppercase font-mono">
            {t('mainSection', 'ASOSIY')}
          </div>
          <div className="space-y-1">
            {mainNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-[#0D9488]/10 text-[#0D9488] dark:bg-[#0D9488]/20 dark:text-[#2DD4BF] border-l-4 border-[#0D9488] pl-2.5'
                      : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100/80 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-white'
                  }`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* HISOB Section */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold tracking-wider text-gray-400 dark:text-slate-400 uppercase font-mono">
            {t('accountSection', 'HISOB')}
          </div>
          <div className="space-y-1">
            {accountNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-[#0D9488]/10 text-[#0D9488] dark:bg-[#0D9488]/20 dark:text-[#2DD4BF] border-l-4 border-[#0D9488] pl-2.5'
                      : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100/80 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-white'
                  }`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* Restructured Bottom Pinned Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-800/60 bg-gray-50/50 dark:bg-slate-900/40 space-y-1.5 shrink-0">
        {/* 1) Foydalanish Shartlari */}
        <NavLink
          to="/terms"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
              isActive
                ? 'text-[#0D9488] bg-[#0D9488]/10'
                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
            }`
          }
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate">{t('navTerms')}</span>
        </NavLink>

        {/* 2) Tungi Rejim Switch */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-teal-400 shrink-0" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <span>{t('darkMode')}</span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              theme === 'dark' ? 'bg-[#0D9488]' : 'bg-gray-300'
            }`}
            role="switch"
            aria-checked={theme === 'dark'}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* 3) Chiqish (Logout Button) */}
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="truncate">{t('logout')}</span>
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ open = false, onClose }) {
  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-72 max-w-[85vw] z-50 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent onClose={onClose} />
      </aside>

      {/* Desktop Permanent Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-gray-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900">
        <SidebarContent onClose={onClose} />
      </aside>
    </>
  );
}
