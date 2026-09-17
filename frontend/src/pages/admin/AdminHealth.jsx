import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { CheckCircleIcon, XCircleIcon, ServerIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function AdminHealth() {
  const { t } = useLanguage();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-health'],
    queryFn: () => api.get('/api/admin/health').then((res) => res.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const services = data?.services || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-h1 flex items-center gap-2">
            <span className="w-1.5 sm:w-2 h-6 sm:h-8 rounded-full bg-primary-500"></span>
            {t('ahTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('ahSubtitle')}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn btn-outline"
        >
          <ArrowPathIcon className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {/* Overall Status */}
      <div className="card p-6 flex items-center gap-4">
        <div
          className={`p-4 rounded-2xl ${
            data?.status === 'operational'
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-red-500/10 text-red-500'
          }`}
        >
          {data?.status === 'operational' ? (
            <CheckCircleIcon className="w-8 h-8" />
          ) : (
            <XCircleIcon className="w-8 h-8" />
          )}
        </div>
        <div>
          <p className="text-lg font-extrabold text-gray-900 dark:text-white capitalize">
            {data?.status}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('ahUptime')} {data?.uptime} · {t('ahErrors24h', { count: data?.errors_24h })}
          </p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(services).map(([name, svc]) => (
          <div
            key={name}
            className="card p-5 card-lift"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  <ServerIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{name}</p>
                  <p className="text-[11px] text-gray-400">{t('ahLatency', { ms: svc.latency_ms })}</p>
                </div>
              </div>
              {svc.status === 'healthy' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircleIcon className="w-3.5 h-3.5" /> {svc.status}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-600 dark:text-red-400">
                  <XCircleIcon className="w-3.5 h-3.5" /> {svc.status}
                </span>
              )}
            </div>
            {svc.block_height && (
              <p className="text-[11px] text-gray-400 mt-3 font-mono">
                {t('ahBlockHeight')} {svc.block_height.toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
