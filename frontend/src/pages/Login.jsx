import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getErrorMessage } from '../utils/helpers';
import LanguageSwitcher from '../components/Common/LanguageSwitcher';
import { SparklesIcon, ArrowLeftIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import {
  checkGoogleOAuthOrigin,
  logGoogleOAuthError,
  getGoogleOAuthErrorMessage,
} from '../lib/googleAuthCheck';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdminMode = searchParams.get('admin') === 'true' || searchParams.has('admin');

  const { googleLogin } = useAuth();
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    checkGoogleOAuthOrigin();

    const handleGoogleCallback = async (response) => {
      if (response?.error) {
        logGoogleOAuthError(response);
        toast.error(getGoogleOAuthErrorMessage(response));
        return;
      }

      setLoading(true);
      try {
        await googleLogin({ token: response.credential });
        navigate(isAdminMode ? '/admin' : '/dashboard');
      } catch (err) {
        toast.error(getErrorMessage(err, t('lgGoogleError')));
      } finally {
        setLoading(false);
      }
    };

    const initGoogleBtn = () => {
      if (window.google?.accounts?.id) {
        try {
          // Disable auto_select and cancel any One Tap prompt to avoid duplicate popup collisions
          window.google.accounts.id.cancel();
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCallback,
            auto_select: false,
            cancel_on_tap_outside: true,
            error_callback: (error) => {
              logGoogleOAuthError(error);
              toast.error(getGoogleOAuthErrorMessage(error));
            },
          });

          const targetDiv = document.getElementById('googleSignInBtn');
          if (targetDiv) {
            targetDiv.innerHTML = '';
            window.google.accounts.id.renderButton(targetDiv, {
              theme: 'filled_blue',
              size: 'large',
              width: '320',
              text: 'continue_with',
              shape: 'pill',
              locale: lang,
            });
          }
        } catch (e) {
          console.warn('GSI init warning:', e);
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
      } else {
        existingScript.onload = initGoogleBtn;
      }
    }

    return () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.cancel();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [googleClientId, googleLogin, navigate, lang, isAdminMode, t]);

  const handleCustomGoogleClick = () => {
    if (window.google?.accounts?.id) {
      try {
        // Cancel any residual One Tap prompt so only the single central OAuth popup opens
        window.google.accounts.id.cancel();
      } catch (e) {
        // ignore
      }
    }
  };

  return (
    <div className="app-ambient min-h-screen flex flex-col justify-center items-center bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-4 py-8 selection:bg-primary-500 selection:text-white transition-colors duration-200">
      
      {/* Top bar: Back Home & Language Switcher */}
      <div className="w-full max-w-[420px] mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition font-bold"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>{t('backHome')}</span>
        </button>

        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-[420px]">
        {/* Simplified Auth Card */}
        <div className="card p-6 sm:p-8 space-y-6 relative overflow-hidden text-center">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-[#0D9488]/15 blur-3xl pointer-events-none" />
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0D9488] via-[#14B8A6] to-[#2DD4BF] text-white flex items-center justify-center mx-auto shadow-[0_4px_20px_rgba(20,184,166,0.4)]">
            <SparklesIcon className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase text-gray-900 dark:text-white">
              FRAGMENTLY-API
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {t('loginSubtitle')}
            </p>
          </div>

          {/* Primary Auth Option: Google Sign In Button with i18n & overlay */}
          <div className="pt-2 flex flex-col items-center justify-center">
            <div
              onClick={handleCustomGoogleClick}
              className="relative w-full max-w-[320px] min-h-[48px] flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-300 dark:border-white/10 font-semibold text-sm shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700/70 transition-all active:scale-[0.99] cursor-pointer overflow-hidden group"
            >
              {/* Visible Google Icon + Localized i18n Button Text */}
              <div className="flex items-center justify-center gap-3 py-3 px-4 z-0 pointer-events-none">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.39 7.37 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.61 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span className="font-medium text-sm tracking-wide">
                  {t('auth.googleSignIn') || t('googleSignIn')}
                </span>
              </div>

              {/* Overlayed Google GIS Button Layer */}
              <div
                id="googleSignInBtn"
                className="absolute inset-0 opacity-0 cursor-pointer flex items-center justify-center z-10 scale-125"
              />
            </div>
          </div>

          {loading && (
            <p className="text-xs text-primary-500 font-bold animate-pulse">
              {t('processing')}
            </p>
          )}

          {/* Admin security alert (concise notice shown ONLY on admin panel login) */}
          {isAdminMode && (
            <div className="pt-2 flex items-center justify-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 dark:bg-red-950/40 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
                <ShieldCheckIcon className="w-4 h-4 shrink-0 text-red-500" />
                <span>{t('adminSecurityActive') || 'Xavfsizlik Himoyasi Faol'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
