/**
 * Split a full display / account name from the server into first + last
 * to match the Settings form (single `name` field on the user record).
 * One word: entire string → firstName; two or more: first token → first, remainder → last.
 */
export function splitDisplayName(
  full: string | null | undefined,
): { firstName: string; lastName: string } {
  const t = (full ?? "").trim();
  if (!t) return { firstName: "", lastName: "" };
  const i = t.indexOf(" ");
  if (i === -1) return { firstName: t, lastName: "" };
  return { firstName: t.slice(0, i), lastName: t.slice(i + 1).trim() };
}
