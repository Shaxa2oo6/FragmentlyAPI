export function shortenAddress(addr, head = 6, tail = 4) {
  if (!addr) return '—';
  return addr.length <= head + tail ? addr : `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

export function formatNumber(value, decimals = 4) {
  const num = Number(value || 0);
  if (num === 0) return '0.00';
  if (Math.abs(num) < 1) {
    return num.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
  }
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
}
