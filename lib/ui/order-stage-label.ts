/**
 * Formats a snake_case order pipeline / stage key for display (charts, copy).
 * Example: "ready_for_warehouse" → "Ready for warehouse"
 */
export function humanizeOrderStageKey(key: string): string {
  if (!key.trim()) return key;
  const words = key
    .toLowerCase()
    .split(/_+/g)
    .filter(Boolean);
  if (words.length === 0) return key;
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
