export function normalizeGstRate(value: unknown, fallback = 0.18): number {
  const num = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num > 1 ? num / 100 : num;
}

export function gstRateToPercent(value: unknown, fallback = 0.18): number {
  return normalizeGstRate(value, fallback) * 100;
}
