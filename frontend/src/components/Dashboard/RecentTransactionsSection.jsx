import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { normalizeTransaction } from '../../utils/transactions';
import { Clock, TrendingUp, Copy, Star, Zap, CheckCircle2, AlertTriangle, RefreshCw, User } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function RecentTransactionsSection({ transactions: propTransactions, onRefreshParent }) {
  const { t } = useLanguage();

  // Auto-fetch recent orders from backend if prop is not supplied
  const {
    data: apiData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['recent-orders-history'],
    queryFn: async () => {
      // Try /api/v1/orders/history/?limit=10&sort=desc
      try {
        const res = await api.get('/api/v1/orders/history/?limit=10&sort=desc');
        return res.data;
      } catch (err1) {
        // Fallback to /api/v1/orders/history/ or /api/transactions
        try {
          const res = await api.get('/api/v1/orders/history/?limit=10');
          return res.data;
        } catch (err2) {
          const res = await api.get('/api/transactions?limit=10');
          return res.data;
        }
      }
    },
    staleTime: 30 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Extract raw transactions array from API data or prop
  const rawList =
    propTransactions && propTransactions.length > 0
      ? propTransactions
      : apiData?.results || apiData?.orders || apiData?.transactions || apiData?.items || (Array.isArray(apiData) ? apiData : []);

  const totalCount = apiData?.total_count ?? apiData?.total ?? rawList.length;

  // Har bir tranzaksiya bitta canonical formatga keltiriladi:
  //   premium -> Miqdor: "30 kun"/"3 oy", Summa: "1.5 TON"
  //   stars   -> Miqdor: "1.61 ⭐",        Summa: "0.5 TON"
  //   balance -> Miqdor: "0.5 TON"
  // Faqat eng oxirgi 10 ta ko'rsatiladi.
  const rows = rawList.slice(0, 10).map((tx) => normalizeTransaction(tx, t)).filter(Boolean);

  const handleCopyId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(String(id));
    toast.success('Tranzaksiya ID nusxalandi!');
  };
  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (['completed', 'bajarildi', 'success', 'paid'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Bajarildi</span>
        </span>
      );
    }
    if (['pending', 'kutilmoqda', 'processing'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock className="w-3.5 h-3.5 animate-spin" />
          <span>Kutilmoqda</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Xatolik</span>
      </span>
    );
  };

  const typeIcon = (tx) => {
    if (tx.typeKey === 'stars') return <Star className="w-3.5 h-3.5" />;
    if (tx.typeKey === 'energy') return <Zap className="w-3.5 h-3.5" />;
    return <Zap className="w-3.5 h-3.5" />;
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#0D9488]" />
          <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
            So'nggi tranzaksiyalar
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Pill Badge */}
          <div className="px-3 py-1 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300">
            Jami: {totalCount} ta tranzaksiya
          </div>

          <button
            type="button"
            onClick={() => {
              refetch();
              if (onRefreshParent) onRefreshParent();
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            title="Tranzaksiyalarni yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoading ? (
        <div className="space-y-3 py-4">
          <div className="h-12 bg-gray-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
          <div className="h-12 bg-gray-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
          <div className="h-12 bg-gray-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
        </div>
      ) : isError ? (
        /* Error Retry State */
        <div className="py-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-xs font-bold text-gray-700 dark:text-slate-300">
            Tranzaksiyalarni yuklashda xatolik yuz berdi
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-[#0D9488] text-white text-xs font-bold shadow-md hover:bg-[#0F766E] transition-all"
          >
            Qayta yuklash
          </button>
        </div>
      ) : rows.length === 0 ? (
        /* True Empty State */
        <div className="py-12 sm:py-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 flex items-center justify-center mb-3">
            <TrendingUp className="w-6 h-6 text-gray-400 dark:text-slate-500" />
          </div>
          <h4 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
            Tranzaksiyalar topilmadi
          </h4>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-sm">
            Hali biror marta tranzaksiya yaratilmagan
          </p>
        </div>
      ) : (
        /* Data Table & Mobile View */
        <div>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 text-[11px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Sana</th>
                  <th className="py-3 px-4">Turi</th>
                  <th className="py-3 px-4">Foydalanuvchi</th>
                  <th className="py-3 px-4">Miqdor</th>
                  <th className="py-3 px-4">Summasi</th>
                  <th className="py-3 px-4">Holati</th>
                  <th className="py-3 px-4 text-right">Tranzaksiya ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-xs font-semibold">
                {rows.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-4 text-gray-500 dark:text-slate-400 font-mono text-[11px]">
                      {tx.createdAt}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            tx.typeKey === 'stars'
                              ? 'bg-teal-500/10 text-[#0D9488]'
                              : 'bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          {typeIcon(tx)}
                        </div>
                        <span className="capitalize font-bold text-gray-900 dark:text-white">
                          {tx.title}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-800 dark:text-slate-200 font-medium">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span>{tx.recipient || '—'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-900 dark:text-white font-bold">
                      {tx.quantity || '—'}
                    </td>
                    <td className="py-4 px-4 text-gray-900 dark:text-white font-bold font-mono">
                      {tx.amount}
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleCopyId(tx.id)}
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-gray-500 dark:text-slate-400 hover:text-[#0D9488] dark:hover:text-[#2DD4BF] transition-colors"
                        title="Nusxalash"
                      >
                        <span>{String(tx.id).length > 12 ? `${String(tx.id).slice(0, 10)}...` : tx.id}</span>
                        <Copy className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (< 768px) */}
          <div className="md:hidden space-y-2.5">
            {rows.map((tx) => (
              <div
                key={tx.id}
                className="p-3.5 space-y-2 rounded-xl bg-white border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-700/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm shrink-0">{tx.icon}</span>
                    <span className="font-bold text-xs capitalize text-gray-900 dark:text-white truncate">
                      {tx.title} ({tx.recipient || '—'})
                    </span>
                  </div>
                  {getStatusBadge(tx.status)}
                </div>

                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="text-gray-400 shrink-0">Miqdor:</span>
                  <span className="font-bold text-gray-900 dark:text-white truncate">{tx.quantity || '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="text-gray-400 shrink-0">Summasi:</span>
                  <span className="font-bold text-gray-900 dark:text-white font-mono truncate">{tx.amount}</span>
                </div>
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="text-gray-400 shrink-0">Sana:</span>
                  <span className="text-gray-500 dark:text-slate-300 font-mono text-xs truncate">{tx.createdAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}