import React from 'react';

import { useLanguage } from '../../context/LanguageContext';
import TransactionRow from './TransactionRow';

export default function TransactionsList({ transactions, search = '' }) {
  const { t } = useLanguage();

  const filtered = (transactions || []).filter((tx) => {
    if (!search) return true;
    const rawQ = search.trim().toLowerCase();
    const cleanQ = rawQ.replace(/^#?tx[-_]/i, '').replace(/^#/, '');
    const userQ = rawQ.replace(/^@/, '');
    const txIdStr = (tx.id || '').toString().toLowerCase();
    const txIdDigits = (txIdStr.match(/\d+/) || [''])[0];
    const userStr = (tx.target_username || tx.premium_user_username || '').toLowerCase();
    return (
      userStr.includes(rawQ) ||
      userStr.includes(userQ) ||
      (tx.type || '').toLowerCase().includes(rawQ) ||
      txIdStr.includes(rawQ) ||
      txIdStr.includes(cleanQ) ||
      (txIdDigits && cleanQ && txIdDigits.includes(cleanQ))
    );
  });

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* DESKTOP TABLE (md+) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px]">
              <th className="text-left font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider py-2.5 px-3">
                Transaction ID
              </th>
              <th className="text-left font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider py-2.5 px-3">
                {t('thType')}
              </th>
              <th className="text-left font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider py-2.5 px-3">
                {t('thInfo')}
              </th>
              <th className="text-left font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider py-2.5 px-3">
                {t('thAmount')}
              </th>
              <th className="text-left font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider py-2.5 px-3">
                {t('thSumma')}
              </th>
              <th className="text-left font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider py-2.5 px-3">
                {t('thStatus')}
              </th>
              <th className="text-left font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider py-2.5 px-3">
                {t('thDate')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-500 dark:text-gray-400 text-xs">
                  {t('txNoResults')}
                </td>
              </tr>
            ) : (
              filtered.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARD LIST (< md) */}
      <div className="md:hidden flex flex-col gap-2.5 p-3.5 sm:p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400 text-xs">
            {t('txNoResults')}
          </div>
        ) : (
          filtered.map((tx) => <TransactionRow key={tx.id} transaction={tx} mobile />)
        )}
      </div>
    </div>
  );
}
