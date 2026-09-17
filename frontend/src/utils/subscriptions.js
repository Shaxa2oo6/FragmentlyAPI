import { formatDate, formatNumber, formatTime } from './helpers';

// Tarifga mos ikonka va rang sxemasi (TA'RIF ustuni uchun).
// Nom bo'yicha (case-insensitive) moslashtiriladi, aks holda "standard" chiqadi.
export const PLAN_META = {
  free: {
    icon: '🎟️',
    chip: 'bg-slate-100 text-slate-600 border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  lite: {
    icon: '⚡',
    chip: 'bg-sky-50 text-sky-600 border-sky-200/70 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20',
  },
  standard: {
    icon: '⭐',
    chip: 'bg-teal-50 text-teal-600 border-teal-200/70 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20',
  },
  pro: {
    icon: '💎',
    chip: 'bg-amber-50 text-amber-600 border-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
  },
  enterprise: {
    icon: '🚀',
    chip: 'bg-emerald-50 text-emerald-600 border-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  },
};

// HARAKAT (badge sxemasi)
export const ACTION_META = {
  purchase: {
    labelKey: 'shActionPurchase',
    className:
      'bg-teal-50 text-teal-600 border-teal-200/70 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20',
    dot: 'bg-teal-500',
  },
  extend: {
    labelKey: 'shActionExtend',
    className:
      'bg-emerald-50 text-emerald-600 border-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
};

// HOLAT (badge sxemasi)
export const STATUS_META = {
  active: {
    labelKey: 'shStatusActive',
    className:
      'bg-emerald-50 text-emerald-600 border-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  expired: {
    labelKey: 'shStatusExpired',
    className:
      'bg-slate-100 text-slate-500 border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  pending: {
    labelKey: 'shStatusPending',
    className:
      'bg-amber-50 text-amber-600 border-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    dot: 'bg-amber-500',
  },
  failed: {
    labelKey: 'shStatusFailed',
    className:
      'bg-rose-50 text-rose-600 border-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
    dot: 'bg-rose-500',
  },
};

export function getPlanMeta(planName = '') {
  const key = String(planName || '').trim().toLowerCase();
  if (PLAN_META[key]) return PLAN_META[key];
  if (key.includes('pro')) return PLAN_META.pro;
  if (key.includes('lite')) return PLAN_META.lite;
  if (key.includes('free')) return PLAN_META.free;
  if (key.includes('enterprise') || key.includes('vip') || key.includes('business')) return PLAN_META.enterprise;
  return PLAN_META.standard;
}

function fmtAmount(value) {
  const n = Number(value || 0);
  if (n === 0) return '0.00';
  if (Math.abs(n) < 1) {
    return parseFloat(n.toFixed(4)).toString();
  }
  return formatNumber(n);
}

// Backenddagi obuna (tarif) xaridi yozuvini display-friendly formatga keltiradi.
export function normalizeSubscription(raw, t) {
  if (!raw) return null;

  const rawStatus = String(raw.status || 'pending').toLowerCase();

  // HOLAT: completed bo'lsa muddatga qarab Active / Expired
  let status = rawStatus;
  if (rawStatus === 'completed') {
    const exp = raw.expires_at ? new Date(raw.expires_at).getTime() : null;
    status = exp !== null && exp <= Date.now() ? 'expired' : 'active';
  }

  const durationDays = Number(raw.duration_days) || 30;
  const startsAt = raw.starts_at || raw.created_at;
  const expiresAt = raw.expires_at;

  const period =
    expiresAt && startsAt
      ? `${formatDate(startsAt)} — ${formatDate(expiresAt)}`
      : `${durationDays} ${t('daySuffix')}`;

  return {
    id: raw.id,
    planId: raw.plan_id,
    planName: raw.plan_name || 'Standard',
    planMeta: getPlanMeta(raw.plan_name),
    action: raw.action || 'purchase',
    actionMeta: ACTION_META[raw.action || 'purchase'] || ACTION_META.purchase,
    status,
    statusMeta: STATUS_META[status] || STATUS_META.pending,
    amount: `${fmtAmount(raw.amount)} ${String(raw.currency || 'GRAM').toUpperCase()}`,
    durationDays,
    period,
    date: startsAt ? `${formatDate(startsAt)} ${formatTime(startsAt)}` : '—',
  };
}