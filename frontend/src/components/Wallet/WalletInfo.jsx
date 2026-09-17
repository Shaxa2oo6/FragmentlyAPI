import React from 'react';
import { clsx } from 'clsx';

import { useLanguage } from '../../context/LanguageContext';

import Button from '../common/Button';
import Badge from '../common/Badge';
import { formatNumber, shortenAddress } from '../../utils/helpers';

import { ArrowPathIcon, ClipboardDocumentIcon, WalletIcon } from '@heroicons/react/24/outline';

export default function WalletInfo({
  walletAddress,
  walletType,
  gram = 0,
  usdt = 0,
  stars = 0,
  onCopy,
  onRefresh,
  onDisconnect,
  loading = false,
  source,
  updatedAt,
}) {
  const { t } = useLanguage();

  const sources = {
    tonapi: 'TonAPI',
    toncenter: 'TON Center',
    none: '—',
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 sm:p-6 shadow-sm w-full">
      {/* Header — Wallet + compact spinning refresh icon */}
      <div className="flex w-full items-center justify-between gap-3 mb-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 min-w-0 truncate font-sans">
          <WalletIcon className="w-5 h-5 text-[#0D9488] shrink-0" />
          <span className="truncate">{t('wiTitle')}</span>
        </h3>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-[#0D9488] hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            aria-label={t('wiRefresh', 'Yangilash')}
            title={t('wiRefresh', 'Yangilash')}
          >
            <ArrowPathIcon className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
        )}
      </div>

      <div className="space-y-3.5">
        {/* Address + copy — same height h-11 */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
            {t('wiAddress')}
          </label>
          <div className="flex items-center gap-2 w-full min-w-0">
            <div className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 flex items-center">
              <span className="text-sm font-mono text-slate-600 dark:text-slate-300 truncate">
                {walletAddress ? shortenAddress(walletAddress, 10, 8) : '—'}
              </span>
            </div>
            {onCopy && (
              <button
                type="button"
                onClick={onCopy}
                className="w-11 h-11 shrink-0 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-[#0D9488] flex items-center justify-center transition-colors cursor-pointer"
                aria-label={t('wiCopy')}
                title={t('wiCopy')}
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {walletType && walletType !== 'Unknown' && (
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('wiWalletType')}</label>
            <Badge tone="accent" dot className="font-mono shrink-0">
              {walletType}
            </Badge>
          </div>
        )}

        {/* Balance cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/40 min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('wiGramBalance')}</p>
            <p className="text-lg font-bold text-teal-600 dark:text-teal-400 break-words mt-1">
              {formatNumber(gram)} GRAM
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/40 min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('wiUsdtBalance')}</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 break-words mt-1">
              {formatNumber(usdt)} USDT
            </p>
          </div>
          {stars > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/40 min-w-0 col-span-2 sm:col-span-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('wiStarsBalance')}</p>
              <p className="text-lg font-bold text-amber-500 break-words mt-1">{formatNumber(stars, 0)} ta</p>
            </div>
          )}
        </div>

        {/* Source + time */}
        <div className="flex w-full items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="truncate">
            {t('wiSource')} {sources[source] || '—'}
          </span>
          {updatedAt && <span className="shrink-0">{new Date(updatedAt).toLocaleTimeString()}</span>}
        </div>

        {onDisconnect && (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onDisconnect}
            className="w-full mt-1 !min-h-[42px] !bg-rose-500 hover:!bg-rose-600 !text-white !font-medium !rounded-xl !shadow-sm"
          >
            {t('pfDisconnectWallet') || 'Hamyonni uzish'}
          </Button>
        )}
      </div>
    </div>
  );
}
