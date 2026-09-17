import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';
import { getErrorMessage } from '../../utils/helpers';
import { useLanguage } from '../../context/LanguageContext';
import { MagnifyingGlassIcon, ArrowPathIcon, LockClosedIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';

const roleColors = {
  user: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  reseller: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  support: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  admin: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  superadmin: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [tariffFilter, setTariffFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, tariffFilter],
    queryFn: () =>
      api
        .get('/api/admin/users', {
          params: { page, limit: 20, q: search || undefined, tariff: tariffFilter || undefined },
        })
        .then((res) => res.data),
  });

  const toggleBlock = useMutation({
    mutationFn: ({ userId, reason }) =>
      api.post(`/api/admin/users/${userId}/toggle-block`, { reason }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const changeTariff = useMutation({
    mutationFn: ({ userId, tariff_plan, reason }) =>
      api.put(`/api/admin/users/${userId}/tariff`, { tariff_plan, reason }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(q.trim());
  };

  const users = data?.items || [];
  const totalPages = data?.total_pages || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-h1">{t('auTitle')}</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('auTotalUsersCount', { count: data?.total || 0 })}
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('auSearchPlaceholder')}
              className="input-field pl-9 w-56 sm:w-64"
            />
          </div>
          <select
            value={tariffFilter}
            onChange={(e) => {
              setTariffFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-28"
          >
            <option value="">{t('auAll')}</option>
            <option value="Free">Free</option>
            <option value="Lite">Lite</option>
            <option value="Pro">Pro</option>
          </select>
        </form>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/5 text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3 font-semibold">{t('auUser')}</th>
                    <th className="px-4 py-3 font-semibold">{t('auRole')}</th>
                    <th className="px-4 py-3 font-semibold">{t('auTariff')}</th>
                    <th className="px-4 py-3 font-semibold">{t('auBalanceTon')}</th>
                    <th className="px-4 py-3 font-semibold">{t('auWallet')}</th>
                    <th className="px-4 py-3 font-semibold">{t('auStatus')}</th>
                    <th className="px-4 py-3 font-semibold text-right">{t('auActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-[140px]">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-[#6355E0] text-white flex items-center justify-center text-[11px] font-extrabold shrink-0">
                            {u.username?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 dark:text-white truncate">
                              @{u.username}
                            </p>
                            <p className="text-[11px] text-gray-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold border ${roleColors[u.role] || roleColors.user}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.tariff_plan}
                          onChange={(e) => {
                            const newPlan = e.target.value;
                            if (newPlan === u.tariff_plan) return;
                            const reason = window.prompt(t('auTariffReasonPrompt'));
                            if (!reason || reason.trim().length < 5) {
                              toast.error(t('auReasonMin5'));
                              return;
                            }
                            changeTariff.mutate({ userId: u.id, tariff_plan: newPlan, reason });
                          }}
                          className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option>Free</option>
                          <option>Lite</option>
                          <option>Pro</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-800 dark:text-gray-200">
                        {u.balance_gram?.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {u.wallet_address ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckBadgeIcon className="w-4 h-4" />
                            <span className="font-mono">{u.wallet_address.slice(0, 8)}...</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">{t('auNo')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            u.is_active
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          }`}
                        >
                          {u.is_active ? t('auActive') : t('auBlocked')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              const reason = window.prompt(
                                u.is_active ? t('auBlockReasonPrompt') : t('auUnblockReasonPrompt')
                              );
                              if (!reason || reason.trim().length < 5) {
                                toast.error(t('auReasonMin5'));
                                return;
                              }
                              toggleBlock.mutate({ userId: u.id, reason });
                            }}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold transition min-h-[32px] ${
                              u.is_active
                                ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                            }`}
                          >
                            <LockClosedIcon className="w-3.5 h-3.5" />
                            {u.is_active ? t('auBlock') : t('auUnblock')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                        {t('auNoUsers')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                {t('prev')}
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                {t('next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
