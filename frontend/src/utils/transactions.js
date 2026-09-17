import { formatDate, formatTime } from './helpers';

// Tranzaksiya birifik birliklarini (units) belgilovchi xarita.
export const TX_TYPE_META = {
  premium: { icon: '👑', titleKey: 'txTypePremium' },
  stars: { icon: '⭐', titleKey: 'txTypeStars' },
  energy: { icon: '⚡', titleKey: 'txTypeEnergy' },
  balance: { icon: '💰', titleKey: 'txTypeBalance' },
  tariff: { icon: '🎫', titleKey: 'txTypeTariff' },
  refund: { icon: '↩️', titleKey: 'txTypeRefund' },
  commission: { icon: '💸', titleKey: 'txTypeCommission' },
  unknown: { icon: '📄', titleKey: 'txTypeOther' },
};

// Backenddagi tur qiymatlarini canonical typeKey ga moslashtirish.
const TYPE_KEY_MAP = {
  premium: 'premium',
  premium_purchase: 'premium',
  premium_subscription: 'premium',
  stars: 'stars',
  star: 'stars',
  energy: 'energy',
  energy_refill: 'energy',
  balance: 'balance',
  balance_topup: 'balance',
  topup: 'balance',
  top_up: 'balance',
  deposit: 'balance',
  tariff: 'tariff',
  refund: 'refund',
  commission: 'commission',
};

// Premium oylarini kunlarga qiyoslash jadvali (Telegram Premium).
const PREMIUM_MONTHS = [30, 60, 90, 91, 180, 182, 365];

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// 1.50000 -> "1.5", 1.61000 -> "1.61", 0 -> "0"
function fmtNum(value, maxDecimals = 4) {
  const n = toNumber(value);
  if (n === 0) return '0';
  return parseFloat(n.toFixed(maxDecimals)).toString();
}

function fmtInt(value) {
  const n = toNumber(value);
  return n % 1 === 0 ? String(n) : fmtNum(n, 0);
}

// ID ni API qabul qiladigan canonical ko'rinishga keltiradi.
// Backend /api/v1/orders _serialize_order'da order_id = fragment_tx_id yoki tx_<id>.
// Shu sababli ekranda va nusxalashda aynan shu qiymat ko'rsatiladi.
function formatTxId(rawId) {
  if (rawId === null || rawId === undefined || rawId === '') return null;
  const s = String(rawId).trim();

  // Fragment/hash ID o'z holicha qoladi (order_id shu bo'ladi)
  if (/^frag[_-]/i.test(s) || /^[A-Za-z0-9_\-]{20,}$/.test(s)) return s;
  // "tx_31", "TX-31", "#TX-31", "31" -> "tx_31"
  const m = s.match(/(\d+)\s*$/);
  if (m) return `tx_${m[1]}`;
  return s;
}

function resolveRecipient(raw) {
  const user = raw && typeof raw.user === 'object' ? raw.user : {};
  const username =
    raw.username ||
    raw.target_username ||
    raw.premium_user_username ||
    raw.telegram_username ||
    user.username ||
    user.telegram_username ||
    '';
  const telegramId = raw.telegram_id || user.telegram_id || user.user_id || '';
  const fallback = raw.target || raw.premium_user_id || '';

  const recipientRaw = username || telegramId || fallback;
  if (!recipientRaw) return null;

  const s = String(recipientRaw);
  if (s.startsWith('@')) return s;
  if (/^\d+$/.test(s)) return s; // telegram_id
  return `@${s}`; // username
}

// Tranzaksiyani turlar bo'yicha to'g'ri talqin qiluvchi canonical format:
//   premium   -> Miqdor: "30 kun" / "3 oy",  Summa: "1.5 TON"
//   stars     -> Miqdor: "1.61 ⭐",          Summa: "0.5 TON"
//   energy    -> Miqdor: "1.61 ⚡",          Summa: "0.5 TON"
//   balance   -> Miqdor: "0.5 TON" (to'ldirilgan summa)
export function normalizeTransaction(raw, t = (key, params) => params || key) {
  if (!raw) return null;

  const typeKey = TYPE_KEY_MAP[String(raw.type || raw.transaction_type || '').toLowerCase()] || 'unknown';

  // Komissiya (commission) tranzaksiyalari foydalanuvchi jadvalida ko'rinmaydi
  if (typeKey === 'commission') return null;

  const meta = TX_TYPE_META[typeKey] || TX_TYPE_META.unknown;

  const currency = String(raw.currency || 'GRAM').toUpperCase();
  const amount = Number(raw.amount ?? 0);

  // Miqdor (Turi bo'yicha dinamik):
  let quantity = null;
  if (typeKey === 'premium') {
    const months = raw.months ?? raw.duration_months ?? null;
    const days = Number(raw.premium_duration ?? raw.duration_days ?? raw.duration ?? 0);
    if (months != null && Number(months) > 0) {
      quantity = `${fmtInt(months)} ${t('txMonthSuffix')}`;
    } else if (days > 0 && PREMIUM_MONTHS.includes(days)) {
      quantity = `${fmtInt(Math.round(days / 30))} ${t('txMonthSuffix')}`;
    } else if (days > 0) {
      quantity = `${fmtInt(days)} ${t('daySuffix')}`;
    }
  } else if (typeKey === 'stars' || typeKey === 'energy') {
    const qty = raw.quantity ?? raw.qty ?? raw.stars ?? raw.energy ?? (typeKey === 'stars' ? raw.amount : null);
    if (qty != null) {
      quantity = `${fmtNum(qty)} ${typeKey === 'energy' ? '⚡' : '⭐'}`;
    }
  } else if (typeKey === 'balance') {
    // BALANCE_TOPUP: kiritilgan summa (TON) — Miqdor ustunida ham ko'rsatiladi
    const topUp = raw.top_up_amount ?? raw.amount;
    if (topUp != null) quantity = `${fmtNum(topUp)} ${currency}`;
  }

  // Summa ustuni: har doim amount (TON/USDT). Balance uchun dublikat qilmaymiz.
  let amountLabel = amount ? `${fmtNum(amount)} ${currency}` : '—';
  if (typeKey === 'balance' && !amount) amountLabel = '—';

  // Ekranda va nusxalashda API qabul qiladigan real identifikator ko'rsatiladi:
  // order_id (fragment_tx_id yoki tx_<id>) -> fragment_tx_id -> tx_<id>.
  const rawId =
    raw.order_id ??
    raw.fragment_tx_id ??
    (raw.id != null ? `tx_${raw.id}` : raw.transaction_id ?? raw.tx_id);

  // QISQA ID: bazadagi raqamli tranzaksiya ID (#TX-12). Uzoq hash
  // (fragment_tx_id / tx_hash) o'rniga doim qisqa ko'rinish ko'rsatiladi va
  // nusxalanadi. Backend `/api/v1/orders/{id}` parseri `#TX-12`/`TX-12`/`12`
  // formatlarini taniydi, shuning uchun bu ID orqali API Search ham topadi.
  const numericId = raw.id ?? raw.transaction_id ?? raw.tx_id;
  const shortId = numericId != null ? `#TX-${numericId}` : '';

  return {
    id: shortId || formatTxId(rawId) || `#TX-${raw.id ?? '0'}`,
    txId: shortId || formatTxId(rawId) || `#TX-${raw.id ?? '0'}`,
    apiId: formatTxId(rawId) || (raw.id != null ? `tx_${raw.id}` : shortId),
    typeKey,
    title: t(meta.titleKey),
    icon: meta.icon,
    recipient: resolveRecipient(raw),
    // Miqdor ustuni: "30 kun", "1.61 ⚡", "0.5 TON"
    quantity,
    // Summa ustuni: "1.5 TON"
    amount: amountLabel,
    status: (raw.status || 'pending').toString().toLowerCase(),
    date: raw.created_at ? formatDate(raw.created_at) : '—',
    time: raw.created_at ? formatTime(raw.created_at) : '',
    createdAt: raw.created_at ? `${formatDate(raw.created_at)} ${formatTime(raw.created_at)}` : '—',
    raw,
  };
}