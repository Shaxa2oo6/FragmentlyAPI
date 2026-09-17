import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  Users,
  Wallet,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];

const tooltipStyle = {
  backgroundColor: 'rgba(255,255,255,0.95)',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  fontSize: '12px',
};

export default function AdminDashboard() {
  const { data: stats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/v1/admin/stats').then((res) => res.data),
    refetchInterval: 15000,
  });

  const chartData = stats?.chart_data || [];
  const tariffData = stats?.tariff_distribution || [];

  const StatCard = ({ title, value, icon: Icon, change, color, subtitle }) => (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-3">
          {change > 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-sm font-medium ${change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {change > 0 ? '+' : ''}{change}%
          </span>
          <span className="text-sm text-gray-400">oxirgi hafta</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-1 h-8 rounded-full bg-indigo-500 inline-block"></span>
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Platforma umumiy metrikalari, daromadlar tahlili va real vaqtdagi faoliyat jurnali
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Tizim barqaror
          </span>
          <span className="hidden sm:flex items-center gap-1 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            {new Date().toLocaleString('uz-UZ')}
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl transition min-h-[38px]"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-72 flex items-center justify-center text-sm text-gray-400">
          Ma'lumotlar yuklanmoqda...
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="JAMI FOYDALANUVCHILAR"
              value={stats?.total_users ?? 0}
              icon={Users}
              change={stats?.user_growth}
              color="bg-gradient-to-r from-blue-500 to-blue-600"
              subtitle={`~${stats?.new_users_this_week ?? 0} yangi (shu hafta)`}
            />
            <StatCard
              title="ULANGAN HAMYONLAR"
              value={stats?.connected_wallets ?? 0}
              icon={Wallet}
              color="bg-gradient-to-r from-emerald-500 to-emerald-600"
              subtitle="Hamyoni faol bog'langan hisoblar"
            />
            <StatCard
              title="JAMI TRANZAKSIYALAR"
              value={stats?.total_transactions ?? 0}
              icon={ShoppingBag}
              change={stats?.transaction_growth}
              color="bg-gradient-to-r from-purple-500 to-purple-600"
              subtitle={`${stats?.transactions_this_week ?? 0} ta (shu hafta)`}
            />
            <StatCard
              title="KOMISSIYA DAROMADI"
              value={`${(stats?.total_commission ?? 0).toFixed(2)} TON`}
              icon={DollarSign}
              color="bg-gradient-to-r from-amber-500 to-amber-600"
              subtitle={`$${(stats?.total_commission_usdt ?? 0).toFixed(2)} USDT`}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Moliyaviy Oqim (TON &amp; USDT)
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                    <span className="text-xs text-gray-500">TON</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span className="text-xs text-gray-500">USDT</span>
                  </div>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="tonGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="usdtGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-gray-400" />
                    <YAxis tick={{ fontSize: 10 }} className="text-gray-400" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="ton" stroke="#6366f1" strokeWidth={2} fill="url(#tonGradient)" />
                    <Area type="monotone" dataKey="usdt" stroke="#10b981" strokeWidth={2} fill="url(#usdtGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">Oxirgi 7 kunlik kunlik tushumlar</p>
            </div>

            {/* Tariff Distribution */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Tariflar Taqsimoti
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tariffData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {tariffData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {tariffData.map((item, index) => (
                  <div key={index} className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {item.percent !== undefined ? `${item.percent}%` : `${item.value}%`}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">
                Foydalanuvchilarning tarif rejasi bo'yicha ulushi
              </p>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                So'nggi faoliyat
              </h3>
              <span className="text-[11px] text-gray-400 font-mono">Har 15s yangilanadi</span>
            </div>
            <div className="space-y-3">
              {stats?.recent_activities?.length > 0 ? (
                stats.recent_activities.map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <div className={`p-2 rounded-lg ${
                      activity.type === 'user'
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : activity.type === 'transaction'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : 'bg-purple-100 dark:bg-purple-900/30'
                    }`}>
                      {activity.type === 'user' ? (
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      ) : activity.type === 'transaction' ? (
                        <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Wallet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">{activity.message}</p>
                      <p className="text-xs text-gray-400">{activity.time}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      activity.status === 'success' || activity.status === 'completed'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : activity.status === 'pending' || activity.status === 'processing'
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  Hozircha faoliyat yo'q
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
