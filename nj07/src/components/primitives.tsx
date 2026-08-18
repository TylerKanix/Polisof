/** Small building blocks shared across panels. */
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
      ? {
          color: PARTY[tone].bright,
          borderColor: `${PARTY[tone].base}55`,
          background: `${PARTY[tone].base}18`,
        }
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
 * Monogram standing in for a portrait.
 *
 * No public-domain portrait source is reachable from this build, so rather
 * than hotlink a campaign photo of uncertain licence, both candidates get the
 * same generated mark. Deterministic from the name, tinted by party.
 */
export function Monogram({
  name,
  party,
  size = 44,
}: {
  name: string;
  party: PartyLetter | null;
  size?: number;
}) {
  const p = partyOf(party);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md font-mono font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        color: p.bright,
        background: `linear-gradient(160deg, ${p.deep}66, #0d1017)`,
        boxShadow: `inset 0 0 0 1px ${p.base}44`,
      }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

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

/** A single race: two bars, share labels, vote counts. */
export function ResultRow({
  cands,
  total,
}: {
  cands: { name: string; party: PartyLetter | null; votes: number }[];
  total: number;
}) {
  const shown = cands.slice(0, 2);
  return (
    <div className="space-y-1">
      {shown.map((c) => {
        const share = total ? (c.votes / total) * 100 : 0;
        const p = partyOf(c.party);
        return (
          <div key={c.name} className="flex items-center gap-2">
            <div className="w-[132px] shrink-0 truncate text-[11px] text-ink-2" title={c.name}>
              {c.name}
            </div>
            <div className="relative h-[7px] flex-1 overflow-hidden rounded bg-white/[0.05]">
              <div
                className="absolute inset-y-0 left-0 rounded"
                style={{ width: `${share}%`, background: p.base }}
              />
            </div>
            <div className="w-[42px] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink">
              {share.toFixed(1)}%
            </div>
            <div className="w-[48px] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-3">
              {c.votes.toLocaleString('en-US')}
            </div>
          </div>
        );
      })}
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
export function Unreported({ action, href }: { action: string; href?: string }) {
  return (
    <div className="rounded border border-dashed border-hairline bg-white/[0.02] px-3 py-2.5">
      <div className="font-mono text-sm text-ink-3">{DASH} no offline source</div>
      <div className="mt-1 text-[11px] leading-snug text-ink-3/80">{action}</div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-block text-[11px] text-dem hover:underline"
        >
          Open the source ↗
        </a>
      ) : null}
    </div>
  );
}
