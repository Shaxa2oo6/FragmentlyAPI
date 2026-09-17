import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { normalizeSubscription } from '../../utils/subscriptions';
import { CardSkeleton } from '../common/Skeleton';

import { CalendarDays, RefreshCw, Layers, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

function Pill({ meta, dot, children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot ? dot : meta.dot} shrink-0`} />
      <span>{children}</span>
    </span>
  );
}

function TariffChip({ sub }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border text-sm shrink-0 ${sub.planMeta.chip}`}
        aria-hidden="true"
      >
        {sub.planMeta.icon}
      </span>
      <span className="font-bold text-gray-900 dark:text-white capitalize">{sub.planName}</span>
    </div>
  );
}

function EmptyState({ t }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 flex items-center justify-center mb-4 shadow-sm">
        <Layers className="w-6 h-6 text-slate-400 dark:text-slate-500" />
      </div>
      <h4 className="text-base font-extrabold text-gray-900 dark:text-white">{t('shEmpty')}</h4>
      <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-sm">
        {t('shEmptyDesc')}
      </p>
    </div>
  );
}

function DesktopTable({ rows, t }) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
            <th className="py-3.5 px-4">{t('shDate')}</th>
            <th className="py-3.5 px-4">{t('shAction')}</th>
            <th className="py-3.5 px-4">{t('shTariff')}</th>
            <th className="py-3.5 px-4">{t('shAmount')}</th>
            <th className="py-3.5 px-4">{t('shPeriod')}</th>
            <th className="py-3.5 px-4">{t('shStatus')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60 text-xs font-semibold">
          {rows.map((sub) => (
            <tr
              key={sub.id}
              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all duration-200"
            >
              <td className="py-4 px-4 text-gray-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                {sub.date}
              </td>
              <td className="py-4 px-4">
                <Pill meta={sub.actionMeta}>{t(sub.actionMeta.labelKey)}</Pill>
              </td>
              <td className="py-4 px-4">
                <TariffChip sub={sub} />
              </td>
              <td className="py-4 px-4 text-gray-900 dark:text-white font-mono whitespace-nowrap">
                {sub.amount}
              </td>
              <td className="py-4 px-4 text-gray-700 dark:text-slate-200 font-mono text-[11px] whitespace-nowrap">
                {sub.period}
              </td>
              <td className="py-4 px-4">
                <Pill meta={sub.statusMeta}>{t(sub.statusMeta.labelKey)}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileList({ rows, t }) {
  return (
    <div className="md:hidden space-y-3 p-4">
      {rows.map((sub) => (
        <div
          key={sub.id}
          className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <TariffChip sub={sub} />
            <Pill meta={sub.statusMeta}>{t(sub.statusMeta.labelKey)}</Pill>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-700/40">
            <span className="text-gray-400">{t('shDate')}</span>
            <span className="text-gray-500 dark:text-slate-300 font-mono">{sub.date}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{t('shAction')}</span>
            <Pill meta={sub.actionMeta}>{t(sub.actionMeta.labelKey)}</Pill>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{t('shAmount')}</span>
            <span className="font-bold text-gray-900 dark:text-white font-mono">{sub.amount}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{t('shPeriod')}</span>
            <span className="text-gray-700 dark:text-slate-200 font-mono">{sub.period}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SubscriptionHistory() {
  const { t } = useLanguage();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['subscription-history', page],
    queryFn: () =>
      api.get(`/api/tariff/history?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`).then((res) => res.data),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const rawList = data?.history || (Array.isArray(data) ? data : []);
  const rows = rawList.map((item) => normalizeSubscription(item, t)).filter(Boolean);
  const total = data?.total ?? rows.length;
  const hasMore = data?.has_more ?? page * PAGE_SIZE + rows.length < total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = (p) => {
    setPage(Math.min(Math.max(p, 0), totalPages - 1));
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-50 text-[#0D9488] dark:bg-teal-500/10 dark:text-teal-300">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
              {t('subHistoryTitle')}
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">{t('subHistorySubtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isLoading && !isError && (
            <span className="px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300">
              {t('total')}: {total}
            </span>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
            title={t('refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="p-5 space-y-3">
          <CardSkeleton rows={3} />
        </div>
      ) : isError ? (
        <div className="px-6 py-14 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-gray-700 dark:text-slate-300">
            {t('shError') || 'Obuna tarixini yuklab bo\'lmadi'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-[#0D9488] text-white text-xs font-bold shadow-md hover:bg-[#0F766E] transition-all"
          >
            {t('retry')}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div>
          <DesktopTable rows={rows} t={t} />
          <MobileList rows={rows} t={t} />

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                {page * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE + rows.length, total)} / {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{t('prev') || 'Oldingi'}</span>
                </button>
                <span className="px-2 py-1 rounded-lg text-xs font-bold text-[#0D9488] bg-[#0D9488]/10">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={!hasMore}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>{t('next') || 'Keyingi'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}