import React from 'react';
import { Coins, Receipt } from 'lucide-react';

export default function TotalTurnoverCard({ gramTurnover = 0, usdtTurnover = 0 }) {
  const formattedGram = gramTurnover.toLocaleString('uz-UZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedUsdt = usdtTurnover.toLocaleString('uz-UZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header Label */}
      <div className="flex items-center gap-2 mb-4 text-xs font-bold text-gray-400 dark:text-slate-400 tracking-wider uppercase">
        <Receipt className="w-4 h-4 text-[#0D9488]" />
        <span>JAMI HISOB-KITOBLAR AYLANMASI</span>
      </div>

      {/* TON (GRAM) + USDT Turnover Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* GRAM Turnover */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-50/50 dark:bg-slate-800/50 border border-blue-100/60 dark:border-slate-700/40">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
              TON (GRAM) aylanmasi
            </p>
            <p className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white mt-1 tracking-tight break-words">
              {formattedGram} GRAM
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-1 font-medium">
              {gramTurnover <= 0 ? "Hozircha xaridlar mavjud emas" : "Bajarilgan barcha GRAM operatsiyalari"}
            </p>
          </div>
        </div>

        {/* USDT Turnover */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50/50 dark:bg-slate-800/50 border border-emerald-100/60 dark:border-slate-700/40">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
              USDT aylanmasi
            </p>
            <p className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white mt-1 tracking-tight break-words">
              {formattedUsdt} USDT
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-1 font-medium">
              {usdtTurnover <= 0 ? "Hozircha xaridlar mavjud emas" : "Bajarilgan barcha USDT operatsiyalari"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
