import React, { useState } from 'react';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function DashboardHeader({ onRefresh, isRefreshing, walletAddress = 'UQDsuZ39vP4xK8yL9c9hL' }) {
  const [copied, setCopied] = useState(false);

  const truncatedAddress = walletAddress.length > 14 
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : walletAddress;

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast.success('Hamyon manzili nusxalandi!', {
      id: 'wallet-copy-toast',
      style: {
        borderRadius: '12px',
        background: '#1E293B',
        color: '#fff',
        fontSize: '13px',
      },
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-lg font-bold sm:text-2xl text-gray-900 dark:text-white tracking-tight">
          Analitika markazi
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1 font-medium">
          Sotib olingan Stars, Premium obunalari va to'lov oqimlarining real vaqtdagi tahlili
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        {/* Wallet Address Chip */}
        <button
          type="button"
          onClick={handleCopyWallet}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700/70 text-xs font-mono font-semibold text-gray-700 dark:text-slate-200 hover:border-[#0D9488] dark:hover:border-[#0D9488] transition-all shadow-sm group"
          title="To'liq manzilni nusxalash"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span>{truncatedAddress}</span>
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#0D9488] transition-colors shrink-0" />
          )}
        </button>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700/70 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/60 hover:text-[#0D9488] dark:hover:text-[#2DD4BF] transition-all shadow-sm disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#0D9488] ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Yangilash</span>
        </button>
      </div>
    </div>
  );
}
