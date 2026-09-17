import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

// Asosiy host — IP ruxsat etilmaganda silent-redirect shu yerga amalga oshadi.
const MAIN_APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:5173';

const IP_CHECK_ENDPOINT = '/api/v1/admin/auth/ip-check';

export default function IPWhitelistGuard({ children }) {
  const [state, setState] = useState('checking'); // checking | allowed | denied | error

  useEffect(() => {
    let active = true;

    api
      .get(IP_CHECK_ENDPOINT, { timeout: 5000 })
      .then((res) => {
        if (!active) return;
        setState(res.data?.allowed === false ? 'denied' : 'allowed');
      })
      .catch(() => {
        if (!active) return;
        setState('error');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state === 'denied') {
      // Ruxsat etilmagan IP — sahifa ochilmaydi, asosiy hostga (/ ) silent-redirect.
      window.location.replace(MAIN_APP_URL);
    }
  }, [state]);

  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span>IP Whitelist Tekshirilmoqda...</span>
        </div>
      </div>
    );
  }

  if (state === 'denied') {
    return null;
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-white">
        <div className="max-w-sm w-full bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center space-y-3">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            IP GUARD OFFLINE
          </span>
          <h1 className="text-sm font-extrabold">Admin Backend yetib bo'lmadi</h1>
          <p className="text-xs text-gray-400 leading-relaxed">
            IP whitelist tekshiruvi bajarilmadi. Backend (port 8001) ishga tushganiga ishonch hosil qiling va sahifani yangilang.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
