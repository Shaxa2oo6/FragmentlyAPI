import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import CodeWindow from './CodeWindow';
import {
  SparklesIcon,
  ArrowRightIcon,
  CodeBracketIcon,
  CheckCircleIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const STATS = [
  { key: 'statsCompleted', value: '150,000+' },
  { key: 'statsAvgTime', value: '< 3 soniya', accent: 'text-emerald-500' },
  { key: 'statsUptime', value: '99.98%', accent: 'text-primary-500' },
  { key: 'statsSupport', value: '24 / 7 Live' },
];

export default function LandingHero() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const goToStart = () => navigate(user ? '/subscriptions' : '/login');

  return (
    <section className="relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[420px] bg-primary-500/15 dark:bg-primary-600/20 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[420px] h-[420px] bg-emerald-500/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-0 -left-32 w-[420px] h-[360px] bg-teal-500/10 rounded-full blur-[110px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-14 md:pt-20 md:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Left column */}
          <div className="text-center lg:text-left space-y-6">
            <div className="animate-fade-up inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-300 text-[11px] sm:text-xs font-semibold max-w-full glass-card">
              <SparklesIcon className="w-4 h-4 text-primary-500 shrink-0" />
              <span className="leading-tight">{t('landingBadge')}</span>
            </div>

            <h1 className="animate-fade-up anim-delay-100 text-3xl sm:text-4xl md:text-5xl xl:text-[3.4rem] font-black text-gray-900 dark:text-white tracking-tight leading-[1.15]">
              {t('landingHero1')}{' '}
              <span className="gradient-text gradient-text-animated">{t('landingHero2')}</span>{' '}
              {t('landingHero3')}
            </h1>

            <p className="animate-fade-up anim-delay-200 max-w-xl mx-auto lg:mx-0 text-sm sm:text-base text-gray-500 dark:text-gray-400 leading-relaxed">
              {t('landingSub')}
            </p>

            {/* Key selling points */}
            <ul className="animate-fade-up anim-delay-300 flex flex-col sm:flex-row flex-wrap justify-center lg:justify-start gap-2.5 text-xs font-bold text-gray-700 dark:text-gray-300">
              <li className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircleIcon className="w-4 h-4 shrink-0" />
                {t('lnHeroPoint1')}
              </li>
              <li className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-300 border border-primary-500/20">
                <CheckBadgeIcon className="w-4 h-4 shrink-0" />
                {t('lnHeroPoint2')}
              </li>
              <li className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/20">
                <ShieldCheckIcon className="w-4 h-4 shrink-0" />
                {t('lnHeroPoint3')}
              </li>
            </ul>

            {/* CTAs */}
            <div className="animate-fade-up anim-delay-400 pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <button
                type="button"
                onClick={goToStart}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-primary-600 to-teal-600 hover:from-primary-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-primary-600/30 transition flex items-center justify-center gap-2 min-h-[48px] press-scale"
              >
                <span>{t('startNow')}</span>
                <ArrowRightIcon className="w-4 h-4" />
              </button>

              <Link
                to="/api-docs"
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold text-sm transition flex items-center justify-center gap-2 min-h-[48px] press-scale"
              >
                <CodeBracketIcon className="w-4 h-4 text-primary-500" />
                <span>{t('navApiDocs')}</span>
              </Link>
            </div>
          </div>

          {/* Right column: interactive code preview */}
          <div className="animate-fade-up anim-delay-300 relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-primary-500/20 via-teal-500/10 to-emerald-500/20 rounded-[2rem] blur-2xl pointer-events-none" />
            <div className="relative animate-float">
              <CodeWindow />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="animate-fade-up anim-delay-500 pt-12 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto text-left">
          {STATS.map((s) => (
            <div key={s.key} className="card card-lift feature-card p-4">
              <span className="text-caption block font-medium">{t(s.key)}</span>
              <span className={`text-lg sm:text-xl font-extrabold font-mono mt-1 block ${s.accent || 'text-gray-900 dark:text-white'}`}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}