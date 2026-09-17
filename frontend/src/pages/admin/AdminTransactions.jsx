import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';
import { getErrorMessage } from '../../utils/helpers';
import { normalizeTransaction } from '../../utils/transactions';
import { useLanguage } from '../../context/LanguageContext';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const statusColors = {
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  processing: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  pending: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  refunded: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

export default function AdminTransactions() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-transactions', page, statusFilter, typeFilter, search],
    queryFn: () =>
      api
        .get('/api/admin/transactions', {
          params: {
            page,
            limit: 20,
            status_filter: statusFilter || undefined,
            type_filter: typeFilter || undefined,
            q: search || undefined,
          },
        })
        .then((res) => res.data),
  });

  const refund = useMutation({
    mutationFn: ({ txId, reason }) =>
      api.post(`/api/admin/transactions/${txId}/refund`, { reason }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(q.trim());
  };

  const items = data?.items || [];
  const totalPages = data?.total_pages || 1;

  // Har bir qator bitta canonical formatga keltiriladi (Miqdor/Summa dinamik).
  const itemViewModels = items.map((it) => normalizeTransaction(it, t)).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-h1">{t('atxTitle')}</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('atxTotalTxCount', { count: data?.total || 0 })}
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('atxSearchPlaceholder')}
              className="input-field pl-9 w-44 sm:w-52"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-32"
          >
            <option value="">{t('atxStatus')}</option>
            <option value="completed">{t('stCompleted')}</option>
            <option value="processing">{t('stProcessing')}</option>
            <option value="pending">{t('stPending')}</option>
            <option value="failed">{t('stFailed')}</option>
            <option value="refunded">{t('stRefunded')}</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-32"
          >
            <option value="">{t('atxType')}</option>
            <option value="stars">Stars</option>
            <option value="premium">Premium</option>
            <option value="tariff">{t('txTypeTariff')}</option>
            <option value="refund">{t('txTypeRefund')}</option>
            <option value="commission">{t('txTypeCommission')}</option>
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
                    <th className="px-4 py-3 font-semibold">{t('atxID')}</th>
                    <th className="px-4 py-3 font-semibold">{t('atxUser')}</th>
                    <th className="px-4 py-3 font-semibold">{t('atxType')}</th>
                    <th className="px-4 py-3 font-semibold">{t('atxSumma')}</th>
                    <th className="px-4 py-3 font-semibold">{t('atxCommission')}</th>
                    <th className="px-4 py-3 font-semibold">{t('atxAddress')}</th>
                    <th className="px-4 py-3 font-semibold">{t('atxStatus')}</th>
                    <th className="px-4 py-3 font-semibold">{t('atxDate')}</th>
                    <th className="px-4 py-3 font-semibold text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                  {itemViewModels.map((vm) => {
                    const t = vm.raw;
                    return (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                      <td className="px-4 py-3 font-mono text-gray-500">{vm.id}</td>
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                        {vm.recipient || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                          {vm.icon} {vm.title}
                        </span>
                        {vm.quantity && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {t('thAmount')}: {vm.quantity}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                        {vm.amount}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-500">
                        {t.commission_amount ?? 0}
                      </td>
<td className="px-4 py-3 text-gray-600 dark:text-gray-300 truncate max-w-[140px]">
  {t.target_username ? `@${t.target_username.replace(/^@/, '')}` : '—'}
</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                            statusColors[t.status] || statusColors.pending
                          }`}
                        >
                          {t.status}
                        </span>
                        {t.refund_reason && (
                          <p className="text-[10px] text-gray-400 mt-0.5 max-w-[140px] truncate">
                            {t.refund_reason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {vm.createdAt}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {t.status !== 'refunded' && (
                            <button
                              onClick={() => {
                                const reason = window.prompt(t('atxRefundReasonPrompt'));
                                if (!reason || reason.trim().length < 5) {
                                  toast.error(t('auReasonMin5'));
                                  return;
                                }
                                refund.mutate({ txId: t.id, reason });
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 text-[11px] font-bold transition min-h-[32px]"
                            >
                              <ArrowPathIcon className="w-3.5 h-3.5" />
                              {t('atxRefund')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">
                        {t('atxNoTx')}
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
