import React from 'react';
import { Star, Zap, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export default function StatsGrid({ stats }) {
  const totalStars = stats?.total_stars ?? 0;
  const totalPremium = stats?.total_premium ?? 0;
  const completedTx = stats?.completed ?? 0;
  const pendingTx = stats?.pending ?? 0;
  const failedTx = stats?.failed ?? 0;

  const statItems = [
    {
      id: 'total-stars',
      title: 'JAMI STARS',
      value: totalStars.toLocaleString('uz-UZ'),
      subtitle: 'Bajarilgan xaridlar',
      icon: Star,
      iconBg: 'bg-[#0D9488]/10 text-[#0D9488] dark:bg-[#0D9488]/20 dark:text-[#2DD4BF]',
    },
    {
      id: 'total-premium',
      title: 'JAMI PREMIUM',
      value: totalPremium.toLocaleString('uz-UZ'),
      subtitle: 'Bajarilgan aktivatsiya',
      icon: Zap,
      iconBg: 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400',
    },
    {
      id: 'completed-tx',
      title: 'BAJARILDI',
      value: completedTx.toLocaleString('uz-UZ'),
      subtitle: 'Tranzaksiya',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400',
    },
    {
      id: 'pending-tx',
      title: 'KUTILMOQDA',
      value: pendingTx.toLocaleString('uz-UZ'),
      subtitle: 'Tranzaksiya',
      icon: Clock,
      iconBg: 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400',
    },
    {
      id: 'failed-tx',
      title: 'XATOLIK',
      value: failedTx.toLocaleString('uz-UZ'),
      subtitle: 'Tranzaksiya',
      icon: AlertTriangle,
      iconBg: 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
      {statItems.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-3.5 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between gap-2"
        >
          {/* Left Text Information */}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 dark:text-slate-400 tracking-wider uppercase truncate">
              {item.title}
            </p>
            <p className="text-base sm:text-2xl font-black text-gray-900 dark:text-white mt-1 tracking-tight">
              {item.value}
            </p>
            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 mt-1 truncate">
              {item.subtitle}
            </p>
          </div>

          {/* Right Soft Circle Icon */}
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${item.iconBg} flex items-center justify-center shrink-0 shadow-inner`}>
            <item.icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      ))}
    </div>
  );
}
