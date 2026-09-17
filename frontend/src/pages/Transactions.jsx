import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { normalizeTransaction } from '../utils/transactions';
import TransactionsList from '../components/Transactions/TransactionsList';
import { CardSkeleton } from '../components/common/Skeleton';
import Button from '../components/common/Button';

import { MagnifyingGlassIcon, ArrowDownTrayIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';

export default function Transactions() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filters = [
    { value: '', label: t('all') },
    { value: 'completed', label: t('filterCompleted') },
    { value: 'pending', label: t('filterPending') },
    { value: 'processing', label: t('filterProcessing') },
    { value: 'failed', label: t('filterFailed') },
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filter, page],
    queryFn: () =>
      api
        .get(
          `/api/transactions?limit=${pageSize}&offset=${(page - 1) * pageSize}${filter ? `&status=${filter}` : ''}`
        )
        .then((res) => res.data),
  });

  const transactions = data?.transactions || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      toast.error("Eksport uchun tranzaksiyalar mavjud emas");
      return;
    }
    const headers = ["Transaction ID", "Turi", "Foydalanuvchi", "Miqdor", "Summasi", "Holati", "Xatolik Sababi", "Sana"];
    const rows = transactions.map((tx) => {
      const vm = normalizeTransaction(tx, t);
      return [
        vm.id,
        vm.title,
        vm.recipient || '—',
        vm.quantity || '—',
        vm.amount,
        vm.status,
        `"${(tx.error_message || tx.refund_reason || '').replace(/"/g, '""')}"`,
        vm.createdAt,
      ];
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV fayl yuklab olindi!");
  };

  const handleExportExcel = () => {
    if (transactions.length === 0) {
      toast.error("Eksport uchun tranzaksiyalar mavjud emas");
      return;
    }
    const headers = ["Transaction ID", "Turi", "Foydalanuvchi", "Miqdor", "Summasi", "Holati", "Xatolik Sababi", "Sana"];
    const rows = transactions.map((tx) => {
      const vm = normalizeTransaction(tx, t);
      return [
        vm.id,
        vm.title,
        vm.recipient || '—',
        vm.quantity || '—',
        vm.amount,
        vm.status,
        `"${(tx.error_message || tx.refund_reason || '').replace(/"/g, '""')}"`,
        vm.createdAt,
      ];
    });
    const csvContent = '\uFEFF' + [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transactions_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel fayl yuklab olindi!");
  };

  const goToPage = (p) => {
    if (p >= 1 && p <= totalPages) setPage(p);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-h1 text-gray-900 dark:text-white">{t('transactionsTitle')}</h1>
          <p className="text-caption mt-1">{t('transactionsSubtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="!min-h-[40px]">
            <ArrowDownTrayIcon className="w-4 h-4 text-[#2ED9A0]" />
            CSV
          </Button>
          <Button size="sm" onClick={handleExportExcel} className="!min-h-[40px]">
            <DocumentArrowDownIcon className="w-4 h-4" />
            Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field !pl-10 !h-10 !rounded-xl"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
          className="input-field !w-auto !h-10 !rounded-xl px-4"
        >
          {filters.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <CardSkeleton rows={2} />
          <CardSkeleton rows={2} />
        </div>
      ) : (
        <TransactionsList transactions={transactions} search={search} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 w-full py-3 px-2">
          <span className="text-sm text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="h-9 px-3.5 py-1.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {t('previous')}
            </button>

            <span className="min-w-[60px] px-3 py-1.5 rounded-lg flex items-center justify-center whitespace-nowrap text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30">
              {page} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="h-9 px-3.5 py-1.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
