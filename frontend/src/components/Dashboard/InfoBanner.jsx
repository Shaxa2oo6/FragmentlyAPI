import React from 'react';
import { Send, ArrowRight } from 'lucide-react';

const DEFAULT_TELEGRAM_URL = import.meta.env.VITE_TELEGRAM_SUPPORT_URL || 'https://t.me/fragmently_official';

export default function InfoBanner({ telegramUrl = DEFAULT_TELEGRAM_URL }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500/10 via-[#0D9488]/10 to-teal-500/10 border border-blue-200/50 dark:border-slate-800 p-4 sm:p-5 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Icon & Message */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
            <Send className="w-5 h-5 -translate-x-0.5 translate-y-0.5 fill-white" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
              So'nggi yangiliklar va yangilanishlar!
            </h4>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              Bizning rasmiy Telegram kanalimizga a'zo bo'ling
            </p>
          </div>
        </div>

        {/* Action Link Button */}
        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-blue-500/15 dark:bg-blue-500/20 hover:bg-blue-500 text-blue-600 dark:text-blue-400 hover:text-white text-xs sm:text-sm font-bold transition-all duration-200 shrink-0 self-start sm:self-center shadow-sm group"
        >
          <span>O'tish</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    </div>
  );
}
