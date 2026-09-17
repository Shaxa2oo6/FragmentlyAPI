import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { api } from '../services/api';
import {
  ShieldCheckIcon,
  SparklesIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import {
  checkGoogleOAuthOrigin,
  logGoogleOAuthError,
  getGoogleOAuthErrorMessage,
  redirectBlockedIP,
} from '../lib/googleAuthCheck';

export default function AdminLogin() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gsiErrorMsg, setGsiErrorMsg] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleAuthResponse = (resData, emailUsed) => {
    if (resData.access_token) {
      login(resData.access_token);
      toast.success(`Xush Kelibsiz Admin: @${resData.username}!`);
      const redirectPath = resData.redirect || '/admin/dashboard';
      navigate(redirectPath, { replace: true });
    }
  };

  useEffect(() => {
    checkGoogleOAuthOrigin();

    const handleGoogleCallback = async (response) => {
      if (response?.error) {
        logGoogleOAuthError(response);
        setGsiErrorMsg(`Google OAuth Xatosi: ${response.error}`);
        toast.error(getGoogleOAuthErrorMessage(response));
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await api.post('/api/v1/admin/auth/google', { token: response.credential });
        handleAuthResponse(res.data, res.data.email || 'google_user');
      } catch (err) {
        if (err.response?.data?.detail === 'IP_NOT_ALLOWED') {
          redirectBlockedIP();
          return;
        }
        toast.error(err.response?.data?.detail || "Google hisobi admin ro'yxatida mavjud emas yoki IP bloklangan");
      } finally {
        setIsSubmitting(false);
      }
    };

    const initGoogleBtn = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCallback,
            error_callback: (error) => {
              logGoogleOAuthError(error);
              setGsiErrorMsg(`Google Origin Xatosi: Joriy origin (${window.location.origin}) Google Cloud Console Authorized JavaScript origins ro'yxatiga kiritilmagan.`);
              toast.error(getGoogleOAuthErrorMessage(error));
            },
          });
          const targetDiv = document.getElementById('adminGoogleBtn');
          if (targetDiv) {
            targetDiv.innerHTML = '';
            window.google.accounts.id.renderButton(targetDiv, {
              theme: 'filled_blue',
              size: 'large',
              width: '340',
              text: 'continue_with',
              shape: 'pill',
            });
          }
        } catch (e) {
          console.warn("GSI init warning:", e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGoogleBtn();
    } else {
      const existingScript = document.getElementById('google-gsi-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'google-gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initGoogleBtn;
        document.body.appendChild(script);
      }
    }
  }, [googleClientId]);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg">
            <SparklesIcon className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight uppercase">
            FRAGMENTLY-API ADMIN CONSOLE
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Faqat tasdiqlangan Admin Google accounts (admin_users) va ruxsat etilgan IP manzillar uchun
          </p>
        </div>

        {/* Security Alert Badge */}
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2 text-xs text-red-300">
          <ShieldExclamationIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Xavfsizlik Himoyasi Faol:</span>
            Parol orqali kirish o'chirilgan! Kirish faqat <strong>Google OAuth 2.0 (admin_users) + IP Whitelist</strong> bilan amalga oshiriladi.
          </div>
        </div>

        {/* Google OAuth Origin Error Alert (if present) */}
        {gsiErrorMsg && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 space-y-1">
            <p className="font-bold text-amber-400">⚠️ Google OAuth Origin Sozlamasi Talab Etiladi:</p>
            <p>{gsiErrorMsg}</p>
            <p className="font-mono text-[11px] bg-black/30 p-1.5 rounded mt-1 select-all">
              Joriy origin: {currentOrigin}
            </p>
            <p className="text-[11px] text-amber-400/80">
              Google Cloud Console &gt; Credentials &gt; Client ID &gt; Authorized JavaScript origins bo'limiga <strong>{currentOrigin}</strong> va <strong>{currentOrigin.replace('localhost', '127.0.0.1')}</strong> manzilini qo'shing.
            </p>
          </div>
        )}

        {/* Google OAuth Button Render */}
        <div className="flex flex-col items-center justify-center pt-2">
          <div id="adminGoogleBtn" className="w-full flex justify-center min-h-[44px]"></div>
        </div>

        <div className="pt-2 text-center text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1.5 font-mono">
          <ShieldCheckIcon className="w-4 h-4 text-emerald-500" />
          <span>Google OAuth 2.0 Verified + IP Whitelist Guard</span>
        </div>
      </div>
    </div>
  );
}
