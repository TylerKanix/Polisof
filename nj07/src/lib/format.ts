/** Display formatting. Every function tolerates null and renders an em dash. */

export const DASH = '—';

export const int = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? DASH : Math.round(v).toLocaleString('en-US');

export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? DASH : `${v.toFixed(digits)}%`;

export const signedPct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || Number.isNaN(v)
    ? DASH
    : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}`;

/** Compact money for tight spaces: $1.2M, $840K. */
export function money(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}

export const moneyFull = (v: number | null | undefined) =>
  v === null || v === undefined ? DASH : `$${Math.round(v).toLocaleString('en-US')}`;

/** Compact vote counts: 1.24M, 84.2K. */
export function compact(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${Math.round(v / 1e3)}K`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

/** Exact age from a birthday, as of a reference date. */
export function ageFrom(birthday: string | null | undefined, on = new Date()): number | null {
  if (!birthday) return null;
  const b = new Date(`${birthday}T00:00:00Z`);
  if (Number.isNaN(b.getTime())) return null;
  let age = on.getUTCFullYear() - b.getUTCFullYear();
  const m = on.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function daysUntil(date: string, from = new Date()): number {
  const d = new Date(`${date}T00:00:00Z`);
  return Math.ceil((d.getTime() - from.getTime()) / 864e5);
}

export const shortDate = (iso: string | null | undefined) =>
  !iso
    ? DASH
    : new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });

export const year = (iso: string | null | undefined) => (iso ? iso.slice(0, 4) : DASH);

/** Initials for the portrait fallback: "Ben Ray Luján" -> "BL". */
export function initials(name: string): string {
  const parts = name
    .replace(/\b(Jr|Sr|II|III|IV|Dr|Mr|Ms|Mrs)\.?\b/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Ordinal for county names in prose: 1st, 2nd, 3rd. */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
