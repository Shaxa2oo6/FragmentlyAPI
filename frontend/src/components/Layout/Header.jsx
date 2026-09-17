import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSwitcher from '../common/LanguageSwitcher';
import { formatNumber } from '../../utils/helpers';
import { Menu, Star, Sun, Moon, LogOut } from 'lucide-react';

export default function Header({ onOpenSidebar }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset imgError when user changes
  useEffect(() => {
    setImgError(false);
  }, [user]);

  const avatarSrc = !imgError
    ? user?.picture || user?.image || user?.avatar || user?.photo_url || user?.profile_picture
    : null;

  const displayName =
    user?.name ||
    user?.full_name ||
    (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : null) ||
    (user?.username ? `@${user.username}` : t('user', 'Foydalanuvchi'));

  const displayEmail = user?.email || '—';

  const userInitial = (
    user?.name ||
    user?.full_name ||
    user?.first_name ||
    user?.username ||
    user?.email ||
    'U'
  )[0].toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-gray-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      {/* Left Logo / Mobile Trigger */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="lg:hidden p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          title={t('menu', 'Menyu')}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 lg:hidden min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#0D9488] to-[#2DD4BF] flex items-center justify-center text-white shrink-0 shadow-sm">
            <Star className="w-4 h-4 fill-white/20 stroke-white" />
          </div>
          <span className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight truncate font-sans">
            FRAGMENTLY-API
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider font-mono">
            FRAGMENTLY-API Stars & Premium Hub
          </span>
        </div>
      </div>

      {/* Right Controls Row */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Switcher (Hidden on mobile < md) */}
        <div className="hidden md:block">
          <LanguageSwitcher />
        </div>

        {/* Theme Toggle (Hidden on mobile < md) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="hidden md:flex p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          title={t('themeToggleTitle', 'Mavzuni o\'zgartirish')}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Profile Avatar & Single Logout Dropdown (Always visible) */}
        <div className="relative pl-2 sm:pl-3 border-l border-gray-200 dark:border-slate-800" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-[#0D9488]/30 transition-all focus:outline-none cursor-pointer"
            aria-expanded={isDropdownOpen}
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={displayName}
                className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover border border-gray-200 dark:border-slate-700 shadow-sm"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#0D9488] text-white flex items-center justify-center font-bold text-xs md:text-sm shadow-sm">
                {userInitial}
              </div>
            )}
          </button>

          {/* Simple Dropdown: Only User Info & Logout Button */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-xl py-2 z-50 animate-fade-in space-y-2">
              {/* User Info Header */}
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-slate-700 shrink-0"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#0D9488] text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                    {userInitial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-400 truncate">
                    {displayEmail}
                  </p>
                </div>
              </div>

              {/* Single Logout Button */}
              <div className="px-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('logout', 'Chiqish')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
