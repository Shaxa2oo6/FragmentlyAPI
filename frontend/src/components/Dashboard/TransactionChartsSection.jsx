import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, Coins, Star, Zap, RefreshCw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const timeFilters = [
  { id: 'weekly', label: 'Haftalik' },
  { id: 'monthly', label: 'Oylik' },
  { id: 'yearly', label: 'Yillik' },
  { id: 'all', label: 'Umumiy' },
];

const tabs = [
  { id: 'turnover', label: 'Aylanma', metric: 'volume' },
  { id: 'stars', label: 'Stars', metric: 'stars' },
  { id: 'premium', label: 'Premium', metric: 'premium' },
  { id: 'transactions', label: 'Tranzaksiyalar', metric: 'transactions' },
  { id: 'peak_hours', label: "Qizg'in vaqtlar", metric: 'peak_hours' },
];

// Clean default empty datasets based on real time period slots
const EMPTY_DATASETS = {
  weekly: [
    { name: 'Dush', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'Sesh', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'Chor', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'Pay', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'Jum', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'Shan', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'Yak', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
  ],
  monthly: [
    { name: '1-Hafta', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: '2-Hafta', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: '3-Hafta', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: '4-Hafta', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
  ],
  yearly: [
    { name: 'Yan', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'Fev', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'Mar', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'Apr', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'May', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'Iyun', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'Iyul', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
    { name: 'Avg', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
  ],
  all: [
    { name: '2026', gram: 0, usdt: 0, stars: 0, premium: 0, completed: 0, pending: 0, failed: 0, activity: 0 },
  ],
};

export default function TransactionChartsSection({ stats }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTimeframe, setActiveTimeframe] = useState('yearly');
  const [activeTab, setActiveTab] = useState('turnover');

  const selectedMetric = tabs.find((t) => t.id === activeTab)?.metric || 'volume';

  // 1. Fetch Chart Data from API: GET /api/v1/analytics/chart/?period={period}&metric={metric}
  const {
    data: chartApiResponse,
    isLoading: isChartLoading,
    refetch: refetchChart,
  } = useQuery({
    queryKey: ['analytics-chart', activeTimeframe, selectedMetric],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/v1/analytics/chart/?period=${activeTimeframe}&metric=${selectedMetric}`);
        return res.data;
      } catch (err) {
        return null;
      }
    },
    staleTime: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // 2. Fetch Status Distribution from API: GET /api/v1/analytics/status-distribution/?period={period}
  const {
    data: statusApiResponse,
    isLoading: isStatusLoading,
  } = useQuery({
    queryKey: ['analytics-status-dist', activeTimeframe],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/v1/analytics/status-distribution/?period=${activeTimeframe}`);
        return res.data;
      } catch (err) {
        return null;
      }
    },
    staleTime: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Transform backend API response dynamically
  const parseChartData = () => {
    if (!chartApiResponse) {
      return EMPTY_DATASETS[activeTimeframe] || EMPTY_DATASETS.yearly;
    }

    // Direct array response
    if (Array.isArray(chartApiResponse)) {
      return chartApiResponse;
    }

    // Backend format with labels & datasets:
    //   - Array form:   { labels: [...], datasets: [{ name: "...", values: [...] }] }
    //   - Object form:  { labels: [...], data: [...], datasets: { volume: [...], stars: [...], premium: [...], count: [...] } }
    if (chartApiResponse.labels && Array.isArray(chartApiResponse.labels)) {
      const labels = chartApiResponse.labels;
      const datasets = chartApiResponse.datasets || {};
      const metric = String(chartApiResponse.metric || selectedMetric || '').toLowerCase();

      return labels.map((label, idx) => {
        const item = { name: label };
        if (Array.isArray(datasets)) {
          // Array form: [{ name, values }]
          datasets.forEach((ds) => {
            const dsName = String(ds.name || '').toLowerCase();
            let key = 'value';
            if (dsName.includes('gram')) key = 'gram';
            else if (dsName.includes('usdt')) key = 'usdt';
            else if (dsName.includes('star')) key = 'stars';
            else if (dsName.includes('premium')) key = 'premium';
            else if (dsName.includes('bajarildi') || dsName.includes('completed')) key = 'completed';
            else if (dsName.includes('kutilmoqda') || dsName.includes('pending')) key = 'pending';
            else if (dsName.includes('xatolik') || dsName.includes('failed')) key = 'failed';
            else if (dsName.includes('faollik') || dsName.includes('activity')) key = 'activity';

            item[key] = ds.values?.[idx] ?? 0;
          });
        } else {
          // Object form: datasets = { volume: [...], stars: [...], premium: [...], count: [...] }
          // Metric-specific series ham `data` sifatida keladi — uni tab'ga mos kalitga tushiramiz.
          const metricSeries = Array.isArray(chartApiResponse.data) ? chartApiResponse.data : null;

          if (metricSeries) {
            if (metric === 'volume' || activeTab === 'turnover') {
              item.gram = datasets.gram?.[idx] ?? metricSeries[idx] ?? 0;
              item.usdt = datasets.usdt?.[idx] ?? 0;
            } else if (metric === 'stars' || activeTab === 'stars') {
              item.stars = metricSeries[idx] ?? 0;
            } else if (metric === 'premium' || activeTab === 'premium') {
              item.premium = metricSeries[idx] ?? 0;
            } else {
              item.completed = datasets.count?.[idx] ?? 0;
            }
          }

          // Qo'shimcha seriyalarni ham to'ldiramiz (agar mavjud bo'lsa)
          if (Array.isArray(datasets.count)) item.completed = datasets.count[idx] ?? 0;
        }
        return item;
      });
    }

    return EMPTY_DATASETS[activeTimeframe] || EMPTY_DATASETS.yearly;
  };

  const chartData = parseChartData();

  // Summary Metrics calculation (from stats prop or API summary)
  const gramTurnover = stats?.total_gram_volume ?? stats?.gram_turnover ?? 0;
  const usdtTurnover = stats?.total_usdt_volume ?? stats?.usdt_turnover ?? 0;
  const totalStars = stats?.total_stars_sold ?? stats?.total_stars ?? 0;
  const totalPremium = stats?.total_premium_activated ?? stats?.total_premium ?? 0;

  // Status Distribution calculation
  const getStatusCounts = () => {
    if (statusApiResponse?.distribution && Array.isArray(statusApiResponse.distribution)) {
      let completed = 0;
      let pending = 0;
      let failed = 0;
      statusApiResponse.distribution.forEach((item) => {
        const st = String(item.status || item.label || '').toLowerCase();
        const val = item.value ?? item.count ?? 0;
        if (st.includes('completed') || st.includes('bajarildi') || st.includes('muvaffaqiyatli')) {
          completed += val;
        } else if (st.includes('pending') || st.includes('kutilmoqda')) {
          pending += val;
        } else if (st.includes('failed') || st.includes('xatolik')) {
          failed += val;
        }
      });
      return { completed, pending, failed };
    }

    return {
      completed: statusApiResponse?.completed ?? stats?.completed_count ?? stats?.completed ?? 0,
      pending: statusApiResponse?.pending ?? stats?.pending_count ?? stats?.pending ?? 0,
      failed: statusApiResponse?.failed ?? stats?.failed_count ?? stats?.failed ?? 0,
    };
  };

  const { completed: completedCount, pending: pendingCount, failed: failedCount } = getStatusCounts();
  const totalTx = statusApiResponse?.total ?? (completedCount + pendingCount + failedCount);

  const pieData = [
    { name: 'Bajarildi', value: completedCount, color: '#10B981' },
    { name: 'Kutilmoqda', value: pendingCount, color: '#F59E0B' },
    { name: 'Xatolik', value: failedCount, color: '#EF4444' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Left Panel — Line Chart Container (70% width) */}
      <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
        <div>
          
          {/* Header Row & Timeframe Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#0D9488]" />
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
                Tranzaksiya grafikalari
              </h3>
            </div>

            {/* Time Filter Buttons */}
            <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1.5 pb-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl -mx-1 px-1">
              {timeFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => {
                    setActiveTimeframe(filter.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    activeTimeframe === filter.id
                      ? 'bg-[#0D9488] text-white shadow-md shadow-[#0D9488]/30'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Metric Pill Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none flex-nowrap border-b border-gray-100 dark:border-slate-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#0D9488] text-white shadow-md shadow-[#0D9488]/30'
                    : 'bg-gray-100/80 dark:bg-slate-800/80 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mini-Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 my-4">
            <div
              onClick={() => setActiveTab('turnover')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                activeTab === 'turnover'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/50 shadow-sm'
                  : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 hover:bg-blue-50/40'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase">
                <Coins className="w-3.5 h-3.5" />
                <span>GRAM AYLANMA</span>
              </div>
              <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-1 font-mono">
                {gramTurnover.toFixed(1)} GRAM
              </p>
            </div>

            <div
              onClick={() => setActiveTab('turnover')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                activeTab === 'turnover'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/50 shadow-sm'
                  : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 hover:bg-emerald-50/40'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">
                <Coins className="w-3.5 h-3.5" />
                <span>USDT AYLANMA</span>
              </div>
              <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-1 font-mono">
                {usdtTurnover.toFixed(2)} USDT
              </p>
            </div>

            <div
              onClick={() => setActiveTab('stars')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                activeTab === 'stars'
                  ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500/50 shadow-sm'
                  : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 hover:bg-teal-50/40'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#0D9488] dark:text-[#2DD4BF] uppercase">
                <Star className="w-3.5 h-3.5" />
                <span>SOTILGAN STARS</span>
              </div>
              <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-1 font-mono">
                {totalStars} ta
              </p>
            </div>

            <div
              onClick={() => setActiveTab('premium')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                activeTab === 'premium'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/50 shadow-sm'
                  : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 hover:bg-amber-50/40'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase">
                <Zap className="w-3.5 h-3.5" />
                <span>PREMIUM OBUNALAR</span>
              </div>
              <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-1 font-mono">
                {totalPremium} ta
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Recharts Box */}
        <div className="w-full h-[240px] sm:h-[320px] mt-2 relative overflow-hidden">
          {isChartLoading && (
            <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
              <RefreshCw className="w-6 h-6 text-[#0D9488] animate-spin" />
            </div>
          )}

          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'turnover' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E293B' : '#E2E8F0'} />
                <XAxis dataKey="name" tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} />
                <YAxis tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                  }}
                />
                <Legend formatter={(val) => (val === 'gram' ? 'TON (GRAM)' : 'USDT')} />
                <Line type="monotone" dataKey="gram" name="gram" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="usdt" name="usdt" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            ) : activeTab === 'stars' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="starsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E293B' : '#E2E8F0'} />
                <XAxis dataKey="name" tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} />
                <YAxis tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="stars" name="Sotilgan Stars" stroke="#0D9488" strokeWidth={3} fill="url(#starsGrad)" />
              </AreaChart>
            ) : activeTab === 'premium' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="premiumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E293B' : '#E2E8F0'} />
                <XAxis dataKey="name" tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} />
                <YAxis tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="premium" name="Premium Obunalar" stroke="#F59E0B" strokeWidth={3} fill="url(#premiumGrad)" />
              </AreaChart>
            ) : activeTab === 'transactions' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E293B' : '#E2E8F0'} />
                <XAxis dataKey="name" tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} />
                <YAxis tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Legend formatter={(val) => (val === 'completed' ? 'Bajarildi' : val === 'pending' ? 'Kutilmoqda' : 'Xatolik')} />
                <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="pending" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="failed" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            ) : (
              /* Peak hours */
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E293B' : '#E2E8F0'} />
                <XAxis dataKey="name" tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} />
                <YAxis unit="%" tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Faollik darajasi']}
                  contentStyle={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="activity" name="Faollik (%)" stroke="#4F46E5" strokeWidth={3} fill="url(#peakGrad)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Right Panel — Status Distribution Donut Chart (30% width) */}
      <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-5 h-5 text-[#0D9488]" />
            <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
              Status taqsimoti
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Tanlangan vaqt oralig'i: <span className="font-bold text-[#0D9488]">{timeFilters.find((f) => f.id === activeTimeframe)?.label}</span>
          </p>
        </div>

        {/* Donut Chart */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[220px] my-2 relative">
          <div className="w-full h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke={isDark ? '#0F172A' : '#FFFFFF'} strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white">{totalTx}</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">JAMI TX</span>
            </div>
          </div>
        </div>

        {/* Status Breakdown Pills */}
        <div className="space-y-2.5 pt-3 border-t border-gray-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-gray-600 dark:text-slate-300">Bajarildi</span>
            </div>
            <span className="text-gray-900 dark:text-white font-bold">{completedCount}</span>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-gray-600 dark:text-slate-300">Kutilmoqda</span>
            </div>
            <span className="text-gray-900 dark:text-white font-bold">{pendingCount}</span>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-gray-600 dark:text-slate-300">Xatolik</span>
            </div>
            <span className="text-gray-900 dark:text-white font-bold">{failedCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
