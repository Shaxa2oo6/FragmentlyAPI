import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { shortenAddress, formatNumber } from '../utils/helpers';

export default function AdminTransactions() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const { data: txData, isLoading } = useQuery({
    queryKey: ['admin-transactions', page, searchTerm, statusFilter, typeFilter, currencyFilter],
    queryFn: () =>
      api
        .get('/api/v1/admin/transactions', {
          params: {
            page,
            limit: 20,
            q: searchTerm || undefined,
            status_filter: statusFilter || undefined,
            type_filter: typeFilter || undefined,
            currency_filter: currencyFilter || undefined,
          },
        })
        .then((res) => res.data),
  });

  const handleCopyId = (id) => {
    const txIdStr = `tx_${id}`;
    navigator.clipboard.writeText(txIdStr);
    setCopiedId(id);
    toast.success(`ID ${txIdStr} nusxalandi!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    const items = txData?.items || [];
    if (items.length === 0) {
      toast.error("Eksport qilish uchun tranzaksiyalar mavjud emas");
      return;
    }

    const headers = ["Transaction ID", "Turi", "Ma'lumot", "Miqdor", "Valyuta", "Holati", "Xatolik Sababi", "Sana"];
    const rows = items.map((t) => [
      `tx_${t.id}`,
      t.transaction_type || '—',
      t.target_username || t.username || '—',
      t.amount || 0,
      t.currency || 'TON',
      t.status || '—',
      `"${(t.error_message || t.refund_reason || '').replace(/"/g, '""')}"`,
      t.created_at || '—',
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admin_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV fayl yuklab olindi!");
  };

  const handleExportExcel = () => {
    const items = txData?.items || [];
    if (items.length === 0) {
      toast.error("Eksport qilish uchun tranzaksiyalar mavjud emas");
      return;
    }

    const headers = ["Transaction ID", "Turi", "Ma'lumot", "Miqdor", "Valyuta", "Holati", "Xatolik Sababi", "Sana"];
    const rows = items.map((t) => [
      `tx_${t.id}`,
      t.transaction_type || '—',
      t.target_username || t.username || '—',
      t.amount || 0,
      t.currency || 'TON',
      t.status || '—',
      `"${(t.error_message || t.refund_reason || '').replace(/"/g, '""')}"`,
      t.created_at || '—',
    ]);

    const csvContent =
      '\uFEFF' + [headers.join('\t'), ...rows.map((e) => e.join('\t'))].join('\n');

    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admin_transactions_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel fayl yuklab olindi!");
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Tranzaksiyalarni Boshqarish (Transaction Ledger)
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Barcha xaridlar, to'lovlar va komissiyalar (foizlar) jurnali.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white font-bold text-xs transition flex items-center justify-center gap-2 min-h-[44px] shrink-0 active:scale-98 shadow-xs"
          >
            <ArrowDownTrayIcon className="w-4 h-4 text-emerald-500" />
            <span>CSV yuklab olish</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 min-h-[44px] shrink-0 active:scale-98 shadow-xs"
          >
            <DocumentArrowDownIcon className="w-4 h-4 text-white" />
            <span>Excel yuklab olish</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="User / Target / Tx Hash..."
              className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Barcha Holatlar</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Barcha Turlar</option>
            <option value="stars">Stars</option>
            <option value="premium">Premium</option>
          </select>

          <select
            value={currencyFilter}
            onChange={(e) => {
              setCurrencyFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Barcha Valyutalar</option>
            <option value="TON">TON</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-slate-800 dark:border-gray-800 text-xs sm:text-sm">
              <tr>
                <th className="py-2.5 px-3">Transaction ID</th>
                <th className="py-2.5 px-3">Foydalanuvchi</th>
                <th className="py-2.5 px-3">Turi / Maqsad</th>
                <th className="py-2.5 px-3">Summa</th>
                <th className="py-2.5 px-3">Komissiya (Foiz)</th>
                <th className="py-2.5 px-3">Tx Hash (Explorer)</th>
                <th className="py-2.5 px-3">Holat</th>
                <th className="py-2.5 px-3">Vaqt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : (txData?.items || []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    Tranzaksiyalar topilmadi
                  </td>
                </tr>
              ) : (
                (txData?.items || []).map((t) => (
                  <tr key={t.id} className="hover:bg-gray-100/60 dark:hover:bg-gray-800/40 transition text-xs sm:text-sm border-b border-slate-800 dark:border-gray-800">
                    <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-white">
                      <div className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                        <span>tx_{t.id}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyId(t.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                          title="ID nusxalash"
                        >
                          {copiedId === t.id ? (
                            <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 font-bold text-gray-800 dark:text-gray-200">@{t.username}</td>

                    <td className="py-2.5 px-3">
                      <span className="font-bold text-primary-500 dark:text-primary-400 uppercase text-[11px] block">{t.transaction_type}</span>
                      <span className="text-[10px] text-gray-500">Target: {t.target_username || '—'}</span>
                    </td>

                    <td className="py-2.5 px-3 font-mono">
                      <span className="font-extrabold text-gray-900 dark:text-white">{formatNumber(t.amount)}</span>{' '}
                      <span className="text-primary-500 dark:text-primary-400 text-[10px]">{t.currency}</span>
                    </td>

                    <td className="py-3 px-4 font-mono">
                      {t.commission_amount != null && t.commission_amount > 0 ? (
                        <>
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">+{formatNumber(t.commission_amount)}</span>{' '}
                          <span className="text-emerald-500/70 text-[10px]">{t.currency}</span>
                        </>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      {t.fragment_tx_id ? (
                        <a
                          href={`https://tonviewer.com/transaction/${t.fragment_tx_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline break-all"
                        >
                          <span>{shortenAddress(t.fragment_tx_id, 8, 6)}</span>
                          <ArrowTopRightOnSquareIcon className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          t.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : t.status === 'failed'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                        title={t.error_message || undefined}
                      >
                        {t.status}
                      </span>
                      {t.status === 'failed' && t.error_message && (
                        <div className="text-[10px] leading-tight text-red-400 max-w-[180px] break-words bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded mt-1" title={t.error_message}>
                          Sabab: {t.error_message}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                      {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Jami: {txData?.total || 0} ta tranzaksiya</span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 disabled:opacity-40"
            >
              Orqaga
            </button>
            <span className="font-mono text-gray-900 dark:text-white">
              {page} / {txData?.total_pages || 1}
            </span>
            <button
              type="button"
              disabled={page >= (txData?.total_pages || 1)}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 disabled:opacity-40"
            >
              Oldinga
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
