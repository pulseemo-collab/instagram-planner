/**
 * Formats counts the way the Instagram app does: full numbers with separators
 * below 10,000, then abbreviated with one trimmed decimal (24.3K, 1.2M).
 */
export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${trimDecimal(value / 1_000_000)}M`;
  if (value >= 10_000) return `${trimDecimal(value / 1_000)}K`;
  return value.toLocaleString("en-US");
}

function trimDecimal(value: number): string {
  const rounded = Math.floor(value * 10) / 10;
  return rounded % 1 === 0 ? String(Math.floor(rounded)) : rounded.toFixed(1);
}
