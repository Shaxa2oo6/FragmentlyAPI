import React, { createContext, useContext, useEffect, useState } from 'react';

import { locales } from '../i18n/locales';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'uz');

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key, params) => {
    const dict = locales[lang] || locales.uz;
    let str;

    if (dict[key] !== undefined) {
      str = dict[key];
    } else if (locales.uz[key] !== undefined) {
      str = locales.uz[key];
    } else {
      const keys = key.split('.');
      const getNested = (obj) => keys.reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
      const foundDict = getNested(dict);
      const foundUz = getNested(locales.uz);
      str = foundDict !== undefined ? foundDict : foundUz !== undefined ? foundUz : key;
    }

    if (params && typeof str === 'string') {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return str;
  };

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

const defaultFallback = {
  lang: localStorage.getItem('lang') || 'uz',
  setLang: () => {},
  t: (key, params) => {
    const dict = locales[localStorage.getItem('lang') || 'uz'] || locales.uz;
    let str;
    if (dict[key] !== undefined) {
      str = dict[key];
    } else if (locales.uz[key] !== undefined) {
      str = locales.uz[key];
    } else {
      const keys = key.split('.');
      const getNested = (obj) => keys.reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
      const foundDict = getNested(dict);
      const foundUz = getNested(locales.uz);
      str = foundDict !== undefined ? foundDict : foundUz !== undefined ? foundUz : key;
    }

    if (params && typeof str === 'string') {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return str;
  },
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  return context || defaultFallback;
}