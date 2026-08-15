/**
 * The hover read: everything you should be able to learn about a matchup
 * without clicking — portraits, age, party, what they held before, and how
 * much cash they are sitting on.
 */
import { candidateAge, describeOffice, headToHead, restOfField } from '../lib/candidate';
import { fmtMargin, type Baseline } from '../lib/analysis';
import { money } from '../lib/format';
import { PARTY, RATING_STYLE, partyOf } from '../lib/palette';
import type { Candidate, Race } from '../lib/types';
import { Chip, Portrait } from './primitives';

export default function HoverCard({
  race,
  baseline,
  photos,
  x,
  y,
  width,
  height,
}: {
  race: Race;
  baseline: Baseline | null;
  photos: Set<string>;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const shown = headToHead(race);
  const rest = restOfField(race, shown);
  const rating = baseline ? RATING_STYLE[baseline.rating] : null;

  // Flip the card across the cursor when it would run off the stage.
  const CARD_W = 396;
  const CARD_H = 250 + shown.length * 10;
  const left = x + CARD_W + 28 > width ? x - CARD_W - 18 : x + 18;
  const top = Math.max(8, Math.min(y - 40, height - CARD_H - 8));

  return (
    <div
      className="pointer-events-none absolute z-30 animate-[fade_120ms_ease-out]"
      style={{ left, top, width: CARD_W }}
    >
      <div className="overflow-hidden rounded-lg border border-white/12 bg-plane/95 shadow-lift backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold tracking-tight text-ink">
              {race.stateName}
              {race.special && <span className="ml-1.5 text-ink-3">· Special</span>}
            </div>
            <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-ink-3">
              {race.open ? 'Open seat' : race.seatHolder.appointed ? 'Appointed incumbent' : 'Incumbent running'}
              {' · Class '}
              {race.seatClass}
            </div>
          </div>
          {rating && (
            <span
              className="shrink-0 rounded px-1.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: `${rating.fill}33`, color: rating.fill, border: `1px solid ${rating.fill}66` }}
            >
              {rating.label}
            </span>
          )}
        </div>

        <div className="grid" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
          {shown.map((c, i) => (
            <CandidateCell key={c.id} c={c} photos={photos} last={i === shown.length - 1} />
          ))}
        </div>

        <div className="space-y-1.5 border-t border-hairline px-3 py-2">
          <Row
            label="Presidential baseline"
            value={fmtMargin(baseline?.presLean ?? null)}
            hint="2024 weighted 65%, 2020 35%"
          />
          {rest.length > 0 && (
            <Row
              label="Rest of the field"
              value={`${rest.length} more`}
              hint={rest.map((c) => `${c.name} (${c.party})`).join(', ')}
            />
          )}
        </div>

        <div className="border-t border-hairline bg-white/[0.02] px-3 py-1.5 text-[10px] text-ink-3">
          Click the state for the full dossier
        </div>
      </div>
    </div>
  );
}

function CandidateCell({
  c,
  photos,
  last,
}: {
  c: Candidate;
  photos: Set<string>;
  last: boolean;
}) {
  const p = partyOf(c.party);
  const { age, exact } = candidateAge(c);
  const office = describeOffice(c);
  const cash = c.finance?.cashOnHand ?? null;

  return (
    <div className={`px-3 py-2.5 ${last ? '' : 'border-r border-hairline'}`}>
      <div className="flex gap-2.5">
        <Portrait
          name={c.name}
          party={c.party}
          bioguide={c.record?.bioguide}
          available={photos}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold leading-tight text-ink" title={c.name}>
            {c.name}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="rounded px-1 py-px font-mono text-[9px] font-bold"
              style={{ background: `${p.base}26`, color: p.bright }}
            >
              {c.party}
            </span>
            <span className="font-mono text-[10px] text-ink-2">
              {age === null ? 'age —' : `${age}${exact ? '' : '~'}`}
            </span>
            {c.status === 'incumbent' && <Chip tone="ghost">INC</Chip>}
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        <div>
          <div className="text-[9px] uppercase tracking-[0.12em] text-ink-3">Office</div>
          <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-ink-2" title={office.primary}>
            {office.primary}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.12em] text-ink-3">Cash on hand</div>
          <div
            className="font-mono text-[13px] leading-tight tabular-nums"
            style={{ color: cash === null ? '#6b7488' : p.bright }}
            title={
              cash === null
                ? 'Not yet pulled from the FEC — run `npm run sync:fec`'
                : `As of ${c.finance?.coverageEnd ?? 'last filing'}`
            }
          >
            {cash === null ? '—' : money(cash)}
          </div>
          {cash === null && (
            <div className="text-[8.5px] leading-tight text-ink-3/70">FEC sync required</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3" title={hint}>
      <span className="text-[10px] uppercase tracking-[0.11em] text-ink-3">{label}</span>
      <span className="font-mono text-[11.5px] tabular-nums text-ink-2">{value}</span>
    </div>
  );
}

export { PARTY };
