import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { CheckCircleIcon, CpuChipIcon } from '@heroicons/react/24/outline';

export default function AdminHealth() {
  const { data: healthData } = useQuery({
    queryKey: ['admin-health'],
    queryFn: () => api.get('/api/v1/admin/health').then((res) => res.data),
    refetchInterval: 10000,
  });

  const services = healthData?.services || {
    api_server: { status: 'healthy', latency_ms: 12 },
    database: { status: 'healthy', latency_ms: 3 },
    redis_cache: { status: 'healthy', latency_ms: 1 },
    fragment_api: { status: 'healthy', latency_ms: 120 },
    ton_blockchain: { status: 'healthy', block_height: 38491024 },
  };

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Tizim Salomatligi va Monitoring (System Health)
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          API Uptime, tashqi servislar va blokcheyn ulanish holati.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">API Uptime (24h)</span>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            {healthData?.uptime || '99.98%'}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">5xx Xatoliklar (24h)</span>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white font-mono">
            {healthData?.errors_24h ?? 2} ta
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Rate-Limit Buzilishlari (24h)</span>
          <div className="text-2xl font-extrabold text-amber-400 font-mono">
            {healthData?.rate_limit_breaches_24h ?? 14} ta
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CpuChipIcon className="w-5 h-5 text-primary-400" />
          Servislar va Tashqi Tizimlar Holati
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {Object.entries(services).map(([key, info]) => (
            <div key={key} className="p-3 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-gray-900 dark:text-white uppercase tracking-wider">{key.replace('_', ' ')}</span>
                {info.latency_ms && <span className="text-[10px] text-gray-500 block font-mono">Latency: {info.latency_ms} ms</span>}
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                <CheckCircleIcon className="w-4 h-4" />
                <span className="capitalize">{info.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
