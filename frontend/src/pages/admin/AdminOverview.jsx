import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { formatDateTime } from '../../utils/helpers';
import { normalizeTransaction } from '../../utils/transactions';
import {
  UsersIcon,
  WalletIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="card p-4 sm:p-5 card-lift">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {title}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
        </div>
        <div className={`p-2.5 sm:p-3 rounded-xl ${color} shrink-0`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const { t } = useLanguage();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/admin/overview/stats').then((res) => res.data),
  });

  const { data: charts } = useQuery({
    queryKey: ['admin-charts'],
    queryFn: () => api.get('/api/admin/overview/charts?period_days=30').then((res) => res.data),
  });

  const { data: activity } = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => api.get('/api/admin/overview/activity').then((res) => res.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const tariffBreakdown = charts?.tariff_breakdown || [];
  const maxTariff = Math.max(1, ...tariffBreakdown.map((tb) => tb.value));

  const statusColors = {
    completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    processing: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    pending: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
    refunded: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 flex items-center gap-2">
          <span className="w-1.5 sm:w-2 h-6 sm:h-8 rounded-full bg-primary-500"></span>
          {t('aoTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('aoSubtitle')}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('aoTotalUsers')} value={stats?.total_users || 0} icon={UsersIcon} color="bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400" />
        <StatCard title={t('aoConnectedWallets')} value={stats?.connected_wallets || 0} icon={WalletIcon} color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" />
        <StatCard title={t('aoTotalTx')} value={stats?.total_transactions || 0} icon={ArrowPathIcon} color="bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" />
        <StatCard title={t('aoActiveSubscribers')} value={stats?.active_subscribers || 0} icon={SparklesIcon} color="bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400" />
        <StatCard title={t('aoWeeklyGrowth')} value={`+${stats?.weekly_user_growth || 0}`} icon={UserPlusIcon} color="bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400" />
        <StatCard title={t('aoCommissionTon')} value={`${(stats?.commission_revenue_ton || 0).toFixed(2)}`} icon={CurrencyDollarIcon} color="bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400" />
      </div>

      {/* Tariff Breakdown */}
      <div className="card p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          {t('aoTariffBreakdown')}
        </h3>
        <div className="space-y-4">
          {tariffBreakdown.map((tb) => (
            <div key={tb.name}>
              <div className="flex items-center justify-between text-xs font-medium mb-1 gap-2">
                <span className="text-gray-700 dark:text-gray-300 truncate">{tb.name}</span>
                <span className="text-gray-500 dark:text-gray-400 shrink-0">{t('aoUsersCount', { count: tb.value })}</span>
              </div>
              <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-500 to-[#2ED9A0]"
                  style={{ width: `${(tb.value / maxTariff) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          {t('aoRecentActivity')}
        </h3>
        {activity && activity.length > 0 ? (
          <div className="space-y-2">
            {activity.map((item) => {
              const vm = normalizeTransaction(item, t);
              return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-100/60 dark:bg-gray-800/50"
              >
                <span
                  className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-extrabold border shrink-0 ${
                    statusColors[item.status] || statusColors.pending
                  }`}
                >
                  {item.status}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {vm ? `${vm.icon} ${vm.title}` : item.type}
                    {item.target && item.target !== '—' ? ` в†’ ${item.target}` : ''}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {item.created_at ? formatDateTime(item.created_at) : ''}
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-900 dark:text-white shrink-0">
                  {item.amount} {item.currency}
                </span>
              </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            {t('aoNoActivity')}
          </p>
        )}
      </div>
    </div>
  );
}
