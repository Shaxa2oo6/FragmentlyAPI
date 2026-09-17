import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useLanguage } from '../../context/LanguageContext';

export default function Chart({ data }) {
  const { t } = useLanguage();

  if (!data || !data.labels || data.labels.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        {t('chartNoData')}
      </div>
    );
  }

  const isDark = document.documentElement.classList.contains('dark');

  const chartData = data.labels.map((label, index) => ({
    date: label,
    transactions: data.transactions?.[index] || 0,
    revenue: data.revenue?.[index] || 0,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="transactions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0D9488" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700/40" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={{ stroke: isDark ? '#232A38' : '#e5e7eb' }}
            tick={{ fill: isDark ? '#7A8294' : '#6b7280', fontSize: 10 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: isDark ? '#7A8294' : '#6b7280', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#131C31' : 'rgba(255,255,255,0.95)',
              border: isDark ? '1px solid #232A38' : '1px solid #e5e7eb',
              borderRadius: '12px',
              color: isDark ? '#F6F7F9' : '#111827',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              fontSize: '12px',
            }}
            labelStyle={{ color: isDark ? '#7A8294' : '#6b7280' }}
          />
          <Area
            type="monotone"
            dataKey="transactions"
            stroke="#0D9488"
            strokeWidth={2}
            fill="url(#transactions)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}