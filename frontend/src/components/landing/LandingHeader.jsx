import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import LanguageSwitcher from '../common/LanguageSwitcher';
import {
  SparklesIcon,
  ArrowRightIcon,
  CodeBracketIcon,
  SunIcon,
  MoonIcon,
  Bars3Icon,
  XMarkIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

const NAV_LINKS = [
  { href: '#features', label: 'lnNavFeatures' },
  { href: '#api', label: 'lnNavApi' },
  { href: '#faq', label: 'lnNavFaq' },
];

export default function LandingHeader() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  const goLogin = () => navigate('/login');

  return (
    <header className="sticky top-0 z-50 glass-card border-b border-gray-200/70 dark:border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 min-w-0" onClick={closeMenu}>
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-primary-600 via-teal-600 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-primary-500/25 shrink-0">
            <SparklesIcon className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-sm sm:text-base md:text-lg tracking-tight text-gray-900 dark:text-white uppercase truncate">
            FRAGMENTLY-API
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-gray-600 dark:text-gray-300">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="relative py-2 hover:text-primary-500 transition after:absolute after:left-0 after:bottom-0 after:h-0.5 after:w-0 after:bg-primary-500 after:transition-all hover:after:w-full"
            >
              {t(item.label)}
            </a>
          ))}
          <Link
            to="/api-docs"
            className="relative py-2 hover:text-primary-500 transition after:absolute after:left-0 after:bottom-0 after:h-0.5 after:w-0 after:bg-primary-500 after:transition-all hover:after:w-full"
          >
            {t('lnNavDocs')}
          </Link>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition min-h-[44px] min-w-[44px] flex items-center justify-center press-scale"
            title={t('toggleThemeTitle')}
            aria-label={t('toggleThemeTitle')}
          >
            {theme === 'dark' ? (
              <SunIcon className="w-4 h-4 text-amber-400" />
            ) : (
              <MoonIcon className="w-4 h-4 text-primary-600" />
            )}
          </button>

          <LanguageSwitcher />

          {user ? (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="hidden sm:inline-flex px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-teal-600 hover:from-primary-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-primary-500/20 transition items-center gap-2 min-h-[40px] press-scale"
            >
              <UserIcon className="w-4 h-4" />
              <span className="hidden md:inline">{t('goDashboard')}</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="hidden sm:inline-flex px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-teal-600 hover:from-primary-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-primary-500/20 transition items-center min-h-[40px] press-scale"
            >
              {t('login')}
            </Link>
          )}

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="lg:hidden p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition min-h-[44px] min-w-[44px] flex items-center justify-center press-scale"
            aria-label={t('lnNav')}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-gray-200 dark:border-white/5 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-1">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition min-h-[44px]"
              >
                <ArrowRightIcon className="w-4 h-4 text-primary-500" />
                {t(item.label)}
              </a>
            ))}
            <Link
              to="/api-docs"
              onClick={closeMenu}
              className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition min-h-[44px]"
            >
              <CodeBracketIcon className="w-4 h-4 text-primary-500" />
              {t('lnNavDocs')}
            </Link>

            <div className="pt-2 pb-1">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    navigate('/dashboard');
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-teal-600 text-white font-bold text-sm shadow-lg shadow-primary-500/20 min-h-[48px] press-scale"
                >
                  {t('goDashboard')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    goLogin();
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-teal-600 text-white font-bold text-sm shadow-lg shadow-primary-500/20 min-h-[48px] press-scale"
                >
                  {t('login')}
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}