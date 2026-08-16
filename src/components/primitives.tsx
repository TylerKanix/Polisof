/** Small building blocks shared across panels. */
import { useMemo } from 'react';
import { DASH, initials } from '../lib/format';
import { PARTY, partyOf } from '../lib/palette';
import type { PartyLetter } from '../lib/types';

export function Chip({
  children,
  tone = 'neutral',
  title,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'D' | 'R' | 'I' | 'warn' | 'ghost';
  title?: string;
}) {
  const style =
    tone === 'D' || tone === 'R' || tone === 'I'
      ? { color: PARTY[tone].bright, borderColor: `${PARTY[tone].base}55`, background: `${PARTY[tone].base}18` }
      : tone === 'warn'
        ? { color: '#eda100', borderColor: '#eda10055', background: '#eda1001a' }
        : undefined;
  return (
    <span
      title={title}
      style={style}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        tone === 'neutral'
          ? 'border-hairline bg-white/5 text-ink-2'
          : tone === 'ghost'
            ? 'border-transparent bg-transparent text-ink-3'
            : ''
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Portrait with a deterministic monogram fallback.
 *
 * Only sitting and former members of Congress have a public-domain portrait,
 * so most challengers land on the monogram. It is generated from the name so
 * the same person always gets the same mark, and tinted by party so the card
 * still reads at a glance.
 */
export function Portrait({
  name,
  party,
  bioguide,
  available,
  size = 56,
}: {
  name: string;
  party: PartyLetter | null;
  bioguide?: string | null;
  available?: Set<string>;
  size?: number;
}) {
  const p = partyOf(party);
  const hasPhoto = bioguide && (!available || available.has(bioguide));
  const mono = useMemo(() => initials(name), [name]);
  // The standalone build inlines portraits as data URIs.
  const inlinePhotos = (globalThis as { __POLISOF_PHOTOS__?: Record<string, string> })
    .__POLISOF_PHOTOS__;
  const src =
    bioguide && inlinePhotos?.[bioguide]
      ? inlinePhotos[bioguide]
      : `${import.meta.env.BASE_URL ?? '/'}photos/${bioguide}.jpg`;

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md ring-1"
      style={{
        width: size,
        height: size * 1.22,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--ring' as any]: `${p.base}55`,
        boxShadow: `inset 0 0 0 1px ${p.base}33`,
        background: `linear-gradient(160deg, ${p.deep}55, #0d1017)`,
      }}
    >
      {hasPhoto ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover object-top"
          style={{ filter: 'saturate(0.85) contrast(1.05)' }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span
            className="font-mono font-semibold tracking-tight"
            style={{ fontSize: size * 0.38, color: p.bright, opacity: 0.85 }}
          >
            {mono}
          </span>
        </div>
      )}
      <div
        className="absolute inset-x-0 bottom-0 h-[3px]"
        style={{ background: p.base }}
        aria-hidden
      />
    </div>
  );
}

/**
 * A labelled figure. `hint` explains provenance on hover; `missing` renders the
 * em dash plus the action that would fill it, so an empty cell always tells the
 * reader why it is empty rather than implying a zero.
 */
export function Stat({
  label,
  value,
  hint,
  missing,
  mono = true,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  missing?: string;
  mono?: boolean;
  accent?: string;
}) {
  const isMissing = value === DASH || value === null || value === undefined;
  return (
    <div className="min-w-0" title={hint}>
      <div className="text-[10px] uppercase tracking-[0.13em] text-ink-3">{label}</div>
      <div
        className={`truncate text-[15px] leading-tight ${mono ? 'font-mono tabular-nums' : ''} ${
          isMissing ? 'text-ink-3' : 'text-ink'
        }`}
        style={accent && !isMissing ? { color: accent } : undefined}
      >
        {isMissing ? DASH : value}
      </div>
      {isMissing && missing ? (
        <div className="mt-0.5 text-[9px] leading-tight text-ink-3/70">{missing}</div>
      ) : null}
    </div>
  );
}

/** Horizontal two-party margin bar, R to the right of centre. */
export function MarginBar({
  margin,
  height = 6,
  max = 40,
}: {
  margin: number | null;
  height?: number;
  max?: number;
}) {
  if (margin === null) {
    return <div className="w-full rounded bg-white/5" style={{ height }} />;
  }
  const clamped = Math.max(-max, Math.min(max, margin));
  const half = (Math.abs(clamped) / max) * 50;
  const isR = clamped > 0;
  return (
    <div className="relative w-full rounded bg-white/[0.06]" style={{ height }}>
      <div
        className="absolute top-0 rounded"
        style={{
          height,
          left: isR ? '50%' : `${50 - half}%`,
          width: `${half}%`,
          background: isR ? PARTY.R.base : PARTY.D.base,
        }}
      />
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
    </div>
  );
}

/** Compositional bar for demographic shares. Segments carry a 2px surface gap. */
export function StackBar({
  segments,
  height = 8,
}: {
  segments: { label: string; value: number; color: string }[];
  height?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className="flex w-full overflow-hidden rounded" style={{ height, gap: 2 }}>
      {segments.map((s) => (
        <div
          key={s.label}
          title={`${s.label}: ${s.value.toFixed(1)}%`}
          style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
        />
      ))}
    </div>
  );
}

export function SectionTitle({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
        {children}
      </h3>
      {right}
    </div>
  );
}

/** Explains a null rather than letting it read as zero. */
export function Unreported({ action }: { action: string }) {
  return (
    <div className="rounded border border-dashed border-hairline bg-white/[0.02] px-3 py-2.5">
      <div className="font-mono text-sm text-ink-3">{DASH} not reported</div>
      <div className="mt-1 text-[11px] leading-snug text-ink-3/80">{action}</div>
    </div>
  );
}
