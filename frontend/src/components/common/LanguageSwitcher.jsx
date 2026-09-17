import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { languages } from '../../i18n/locales';
import { GlobeAltIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

export default function LanguageSwitcher({ className = '' }) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLangObj = languages.find((l) => l.code === lang) || languages[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700/80 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700/80 text-xs font-semibold transition active:scale-95 min-h-[34px]"
        title={currentLangObj.label}
      >
        <GlobeAltIcon className="hidden sm:block w-4 h-4 text-primary-500" />
        <span className="hidden sm:inline">{currentLangObj.label}</span>
        <span className="sm:hidden uppercase font-bold tracking-wide">{currentLangObj.code}</span>
        <ChevronDownIcon className={`hidden sm:block w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-36 card py-1.5 z-50">
          {languages.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                setLang(item.code);
                setOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 text-xs font-bold transition flex items-center justify-between ${
                lang === item.code
                  ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span>{item.label}</span>
              {lang === item.code && <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
