function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function formatTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDateTime(date) {
  if (!date) return '—';
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function truncate(str, len = 20) {
  if (!str) return '';
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

export function shortenAddress(addr, head = 6, tail = 4) {
  if (!addr) return '—';
  return addr.length <= head + tail ? addr : `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function normalizeUsername(username) {
  return (username || '').trim().replace(/^@/, '').toLowerCase();
}

export function formatNumber(value, decimals = 4) {
  const num = Number(value || 0);
  if (num === 0) return '0.00';
  if (Math.abs(num) < 1) {
    // Kichik balanslar (masalan: 0.0495 yoki 0.005): aniqlikni saqlaymiz
    return num.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
  }
  const maxDecimals = Math.min(Math.max(decimals, 2), 20);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  });
}

export function formatStarPrice(starPrice) {
  const price = Number(starPrice || 0);
  if (price === 0) return '0.0065';
  return price < 0.01 ? price.toFixed(4) : price.toFixed(2);
}

export function getErrorMessage(err, fallback = 'Xatolik yuz berdi') {
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return 'Backend serverga ulanib bo\'lmadi (http://localhost:8000). Backend server ishga tushirilganini tekshiring.';
  }
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (typeof detail === 'object' && detail !== null) {
    return detail.message || JSON.stringify(detail);
  }
  return err?.response?.data?.message || err?.message || fallback;
}