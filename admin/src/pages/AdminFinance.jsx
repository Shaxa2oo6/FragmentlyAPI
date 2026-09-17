import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import {
  BanknotesIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  WalletIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatNumber } from '../utils/helpers';

const PERIODS = [
  { label: '7 kun', days: 7 },
  { label: '30 kun', days: 30 },
  { label: '90 kun', days: 90 },
  { label: 'Barcha vaqt', days: 0 },
];

const tooltipStyle = {
  backgroundColor: 'rgba(255,255,255,0.98)',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  fontSize: '12px',
};

export default function AdminFinance() {
  const [period, setPeriod] = useState(30);

  const { data: finance, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-finance', period],
    queryFn: () =>
      api
        .get('/api/v1/admin/finance/overview', { params: { days: period } })
        .then((res) => res.data),
    refetchInterval: 60000,
  });

  const { data: payouts } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: () => api.get('/api/v1/admin/finance/payouts?limit=50').then((res) => res.data),
  });

  const { data: pWallet } = useQuery({
    queryKey: ['admin-platform-wallet'],
    queryFn: () => api.get('/api/admin/settings/wallet').then((res) => res.data),
  });

  const s = finance?.summary || {};
  const chartData = finance?.chart_data || [];

  const SummaryCard = ({ title, ton, usdt, icon: Icon, tone }) => (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-2 rounded-xl ${tone}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">{title}</h3>
      </div>
      <div className="space-y-1.5 font-mono">
        <p className="text-xl font-extrabold text-gray-900 dark:text-white">
          {formatNumber(ton)} <span className="text-xs font-sans text-indigo-500">TON</span>
        </p>
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          ${formatNumber(usdt)} <span className="text-xs font-sans text-gray-400">USDT</span>
        </p>
      </div>
    </div>
  );

  const handleExportCSV = () => {
    const items = finance?.recent_transactions || [];
    if (items.length === 0) {
      toast.error("Eksport qilish uchun tranzaksiyalar mavjud emas");
      return;
    }
    const headers = ['ID', 'User', 'Type', 'Status', 'Amount', 'Commission', 'Currency', 'CreatedAt'];
    const rows = items.map((t) => [
      t.id,
      t.username,
      t.transaction_type,
      t.status,
      t.amount,
      t.commission_amount,
      t.currency,
      t.created_at || '',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `finance_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV fayl yuklab olindi!");
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-1.5 h-8 rounded-full bg-emerald-500 inline-block"></span>
            Moliyaviy Hisobot &amp; Foyda
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Komissiya tushumlari va obuna sotuvlaridan olingan foyda asosida sof foyda hisobi
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setPeriod(p.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  period === p.days
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl transition min-h-[38px]"
            title="Yangilash"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 min-h-[38px]"
          >
            <ArrowDownTrayIcon className="w-4 h-4 text-emerald-400" />
            CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-72 flex items-center justify-center text-sm text-gray-400">
          Moliyaviy ma'lumotlar yuklanmoqda...
        </div>
      ) : (
        <>
          {/* Net profit highlight */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                Sof Foyda (Net Profit) — {period === 0 ? 'Barcha vaqt' : `So'nggi ${period} kun`}
              </p>
              <div className="flex flex-wrap gap-8 mt-3 font-mono">
                <div>
                  <span className="text-3xl font-extrabold">{formatNumber(s.net_profit_gram)}</span>
                  <span className="ml-2 text-sm font-sans font-semibold">TON</span>
                </div>
                <div>
                  <span className="text-3xl font-extrabold">${formatNumber(s.net_profit_usdt)}</span>
                  <span className="ml-2 text-sm font-sans font-semibold">USDT</span>
                </div>
              </div>
              <p className="text-xs text-emerald-50 mt-2">
                = Komissiya daromadi + Obuna sotuvlaridan olingan foyda
              </p>
            </div>

            <SummaryCard
              title="Komissiya Daromadi"
              ton={s.commission_gram}
              usdt={s.commission_usdt}
              icon={BanknotesIcon}
              tone="bg-gradient-to-r from-amber-500 to-orange-600"
            />
            <SummaryCard
              title="Obuna Sotuvlaridan Foyda (Premium + Tarif)"
              ton={s.subscription_gram}
              usdt={s.subscription_usdt}
              icon={SparklesIcon}
              tone="bg-gradient-to-r from-indigo-500 to-purple-600"
            />
            <SummaryCard
              title="Umumiy Foyda"
              ton={s.total_revenue_gram}
              usdt={s.total_revenue_usdt}
              icon={CurrencyDollarIcon}
              tone="bg-gradient-to-r from-emerald-500 to-teal-600"
            />
            <SummaryCard
              title="Chiqarilgan Pullar (Payouts)"
              ton={s.withdrawals_gram}
              usdt={s.withdrawals_usdt}
              icon={ArrowDownTrayIcon}
              tone="bg-gradient-to-r from-gray-500 to-gray-700"
            />
          </div>

          {/* Chart + Wallet */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Kunlik Tushum (Gross Revenue)
                </h3>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-3 h-3 rounded-full bg-indigo-500" /> TON
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" /> USDT
                  </span>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-gray-400" />
                    <YAxis tick={{ fontSize: 10 }} className="text-gray-400" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="ton" name="TON" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="usdt" name="USDT" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Platform wallet snapshot */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <WalletIcon className="w-4 h-4 text-emerald-500" />
                Platforma Hamyoni Holati
              </h3>
              <div className="space-y-3 font-mono">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <p className="text-xs text-gray-400">Joriy TON Balans</p>
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                    {formatNumber(pWallet?.balance_gram)}
                    <span className="text-xs font-sans text-indigo-500 ml-1">TON</span>
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <p className="text-xs text-gray-400">Joriy USDT Balans</p>
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                    ${formatNumber(pWallet?.balance_usdt)}
                    <span className="text-xs font-sans text-emerald-500 ml-1">USDT</span>
                  </p>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Jami yig'ilgan komissiya (all-time)</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatNumber(pWallet?.total_commission_gram)} TON
                  </p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    ${formatNumber(pWallet?.total_commission_usdt)} USDT
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-gray-400">
                Tranzaksiya soni: {finance?.counts?.completed_transactions ?? 0} bajarilgan /{' '}
                {finance?.counts?.total_payouts ?? 0} payout
              </p>
            </div>
          </div>

          {/* Recent financial transactions */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              So'nggi Moliyaviy Tranzaksiyalar
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2 pr-4">ID / User</th>
                    <th className="py-2 pr-4">Turi</th>
                    <th className="py-2 pr-4">Summa</th>
                    <th className="py-2 pr-4">Komissiya</th>
                    <th className="py-2 pr-4">Holat</th>
                    <th className="py-2 pr-4">Vaqt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(finance?.recent_transactions || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400">
                        Hozircha moliyaviy tranzaksiyalar yo'q
                      </td>
                    </tr>
                  ) : (
                    (finance?.recent_transactions || []).map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                        <td className="py-2.5 pr-4">
                          <span className="font-mono font-bold text-gray-900 dark:text-white">#{t.id}</span>
                          <span className="text-gray-400 block">@{t.username}</span>
                        </td>
                        <td className="py-2.5 pr-4 uppercase font-semibold text-indigo-600 dark:text-indigo-400">
                          {t.transaction_type}
                        </td>
                        <td className="py-2.5 pr-4 font-mono font-bold text-gray-900 dark:text-white">
                          {formatNumber(t.amount)} <span className="text-gray-400">{t.currency}</span>
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-emerald-600 dark:text-emerald-400">
                          +{formatNumber(t.commission_amount)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              t.status === 'completed'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-400 font-mono">
                          {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payout history */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Chiqarilgan Pullar Tarixi (Payouts)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2 pr-4">ID</th>
                    <th className="py-2 pr-4">Summa</th>
                    <th className="py-2 pr-4">Qabul Qiluvchi</th>
                    <th className="py-2 pr-4">Admin</th>
                    <th className="py-2 pr-4">Holat</th>
                    <th className="py-2 pr-4">Vaqt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(payouts?.items || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400">
                        Chiqarilgan pullar yo'q
                      </td>
                    </tr>
                  ) : (
                    (payouts?.items || []).map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                        <td className="py-2.5 pr-4 font-mono font-bold text-gray-900 dark:text-white">#{p.id}</td>
                        <td className="py-2.5 pr-4 font-mono font-bold text-gray-900 dark:text-white">
                          {formatNumber(p.amount)} <span className="text-gray-400">{p.currency}</span>
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-gray-500 dark:text-gray-400 break-all">
                          {p.destination_address}
                        </td>
                        <td className="py-2.5 pr-4">@{p.admin_username}</td>
                        <td className="py-2.5 pr-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-400 font-mono">
                          {p.created_at ? new Date(p.created_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
