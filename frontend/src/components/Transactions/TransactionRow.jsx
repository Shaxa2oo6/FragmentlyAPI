import React, { useState } from 'react';

import { useLanguage } from '../../context/LanguageContext';
import { normalizeTransaction } from '../../utils/transactions';
import Badge from '../common/Badge';
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

const statusTone = {
  completed: 'success',
  pending: 'warning',
  processing: 'accent',
  failed: 'danger',
  refunded: 'neutral',
};

const statusLabels = {
  completed: 'stCompleted',
  pending: 'stPending',
  processing: 'stProcessing',
  failed: 'stFailed',
};

const statusEmojis = {
  completed: '✅',
  pending: '⏳',
  processing: '🔄',
  failed: '❌',
  refunded: '↩️',
};

// Xatolik sababi — bitta qatorda truncate, hover'da tooltip.
// Karta ichida FAQAT bitta joyda (pastda) ko'rsatiladi.
function ErrorReasonBlock({ label, reason }) {
  if (!reason) return null;
  return (
    <div className="flex items-center gap-1.5 text-[11px] leading-tight text-rose-600 dark:text-rose-400 font-normal min-w-0 w-full">
      <span className="relative group shrink-0">
        <InformationCircleIcon className="w-3.5 h-3.5 cursor-help" />
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block z-20 w-max max-w-[240px] px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-[10px] leading-snug font-normal whitespace-normal shadow-lg">
          <span className="font-semibold">{label}:</span> {reason}
        </span>
      </span>
      <span className="truncate max-w-[200px]">{reason}</span>
    </div>
  );
}

function RefundReasonBlock({ reason }) {
  if (!reason) return null;
  return (
    <div className="flex items-center gap-1.5 text-[11px] leading-tight text-gray-500 dark:text-gray-400 font-normal min-w-0 w-full">
      <span className="truncate max-w-[200px]">{reason}</span>
    </div>
  );
}

function StatusBadge({ tx, tr }) {
  return (
    <Badge tone={statusTone[tx.status] || 'neutral'} dot className="shrink-0">
      {statusEmojis[tx.status] || '⏳'} {tx.status === 'refunded' ? tr('stRefunded') : tr(statusLabels[tx.status]) || tx.status}
    </Badge>
  );
}

function CopyIdButton({ tx }) {
  const { t: tr } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    const copyValue = tx.txId || tx.id;
    navigator.clipboard.writeText(copyValue);
    setCopied(true);
    toast.success(`ID ${copyValue} nusxalandi!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopyId}
      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition shrink-0"
      title="ID nusxalash"
    >
      {copied ? (
        <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-[#2ED9A0]" />
      ) : (
        <ClipboardDocumentIcon className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function DesktopRow({ tx, tr }) {
  return (
    <tr className="border-b border-gray-100 dark:border-white/5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
      <td className="py-2.5 px-3">
        <div className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg border border-gray-200 dark:border-white/5">
          <span className="font-mono font-bold text-gray-900 dark:text-white text-xs">{tx.id}</span>
          <CopyIdButton tx={tx} />
        </div>
      </td>
      <td className="py-2.5 px-3">
        <span className="font-medium text-gray-700 dark:text-gray-200 text-xs whitespace-nowrap">
          {tx.icon} {tx.title}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span className="text-gray-900 dark:text-white font-medium text-xs truncate block max-w-[120px]">
          {tx.recipient ? tx.recipient : '—'}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span className="text-gray-900 dark:text-white font-medium text-xs whitespace-nowrap">
          {tx.quantity || '—'}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span className="text-gray-900 dark:text-white font-mono font-medium text-xs whitespace-nowrap">
          {tx.amount}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <div className="flex flex-col items-start gap-1">
          <StatusBadge tx={tx} tr={tr} />
          {tx.status === 'failed' && (
            <ErrorReasonBlock label={tr('errReasonLabel')} reason={tx.raw.error_message || tx.raw.refund_reason} />
          )}
          {tx.status === 'refunded' && <RefundReasonBlock reason={tx.raw.refund_reason} />}
        </div>
      </td>
      <td className="py-2.5 px-3">
        <div className="text-gray-700 dark:text-gray-200 text-xs whitespace-nowrap">{tx.date}</div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{tx.time}</div>
      </td>
    </tr>
  );
}

function MobileRow({ tx, tr }) {
  return (
    <div className="p-4 sm:p-4.5 rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800/40 w-full space-y-3.5">
      {/* Header: TX ID + Status — faqat badge (xatolik matni bu yerda YO'Q) */}
      <div className="flex items-start justify-between gap-2 w-full">
        <div className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg border border-gray-200 dark:border-white/5 flex-shrink-0">
          <span className="font-mono font-bold text-gray-900 dark:text-white text-sm">{tx.id}</span>
          <CopyIdButton tx={tx} />
        </div>
        <StatusBadge tx={tx} tr={tr} />
      </div>

      {/* Sana / Vaqt — simmetrik */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-400 dark:text-gray-500 font-medium">{tr('thDate')}</span>
        <span className="text-gray-600 dark:text-gray-300 font-mono">
          {tx.date} {tx.time && <span className="text-gray-400">· {tx.time}</span>}
        </span>
      </div>

      {/* Asosiy ma'lumot: chapda tur + username, o'ngda miqdor + summa */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-left">
          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            {tx.icon} {tx.title}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {tx.recipient ? tx.recipient : '—'}
          </p>
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          {tx.quantity && tx.quantity !== '—' && (
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{tx.quantity}</p>
          )}
          <p className="font-mono font-bold text-gray-900 dark:text-white text-sm whitespace-nowrap">{tx.amount}</p>
        </div>
      </div>

      {/* Xatolik — FAQAT bu yerda, bitta qatorda, pushti fonda */}
      {tx.status === 'failed' && (tx.raw.error_message || tx.raw.refund_reason) && (
        <div className="px-2.5 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 w-full">
          <ErrorReasonBlock label={tr('errReasonLabel')} reason={tx.raw.error_message || tx.raw.refund_reason} />
        </div>
      )}
      {tx.status === 'refunded' && tx.raw.refund_reason && (
        <div className="px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 w-full">
          <RefundReasonBlock reason={tx.raw.refund_reason} />
        </div>
      )}
    </div>
  );
}

export default function TransactionRow({ transaction, mobile = false }) {
  const { t: tr } = useLanguage();

  const tx = normalizeTransaction(transaction, tr);
  if (!tx) return null;

  return mobile ? <MobileRow tx={tx} tr={tr} /> : <DesktopRow tx={tx} tr={tr} />;
}
