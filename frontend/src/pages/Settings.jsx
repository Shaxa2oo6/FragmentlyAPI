import React from 'react';

import { LanguageIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { languages } from '../i18n/locales';

export default function Settings() {
  const { lang, setLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-h1 text-gray-900 dark:text-white">{t('settingsTitle')}</h1>
        <p className="text-caption mt-1">{t('settingsSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="card p-5">
          <h3 className="text-h2 text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <LanguageIcon className="w-5 h-5 text-[#0D9488]" />
            {t('language')}
          </h3>
          <p className="text-caption mb-4">{t('settingsLanguageDesc')}</p>
          <div className="grid grid-cols-2 gap-2">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-[10px] border transition press-scale ${
                  lang === l.code
                    ? 'border-primary-500 bg-primary-500 text-white font-bold shadow-[0_4px_16px_rgba(20,184,166,0.3)]'
                    : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-h2 text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            {theme === 'dark' ? (
              <MoonIcon className="w-5 h-5 text-[#0D9488]" />
            ) : (
              <SunIcon className="w-5 h-5 text-amber-500" />
            )}
            {t('settingsTheme')}
          </h3>
          <p className="text-caption mb-4">{t('settingsThemeDesc')}</p>

          <button
            type="button"
            onClick={toggleTheme}
            className={`w-full py-3 px-4 rounded-[10px] border text-sm font-bold flex items-center justify-between transition min-h-[48px] press-scale ${
              theme === 'dark'
                ? 'border-primary-500/40 bg-primary-500/10 text-primary-500'
                : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              {theme === 'dark' ? (
                <>
                  <MoonIcon className="w-5 h-5" />
                  {t('darkMode')}
                </>
              ) : (
                <>
                  <SunIcon className="w-5 h-5" />
                  {t('lightMode')}
                </>
              )}
            </span>
            <span
              className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                theme === 'dark' ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
