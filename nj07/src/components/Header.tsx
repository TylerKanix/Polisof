/** The masthead: who is running, how long is left, and how stale the roster is. */
import { HOUSE_24, districtSummary } from '../lib/analysis';
import { daysUntil, shortDate } from '../lib/format';
import { PARTY, partyOf } from '../lib/palette';
import { useUI } from '../lib/store';
import type { DistrictFile, RaceFile } from '../lib/types';
import { Chip } from './primitives';

export default function Header({ district, race }: { district: DistrictFile; race: RaceFile }) {
  const { setPalette, setProvenance, select } = useUI();
  const r = race.race;
  const days = daysUntil(r.electionDay);
  const last = districtSummary(district, HOUSE_24);

  return (
    <header className="z-30 flex h-[52px] shrink-0 items-center gap-4 border-b border-hairline bg-plane px-4">
      <button
        onClick={() => select(null)}
        className="flex items-baseline gap-2 text-left"
        title="Back to the district"
      >
        <span className="font-mono text-[13px] font-semibold tracking-[0.24em] text-ink">
          POLISOF
        </span>
        <span className="font-mono text-[13px] tracking-[0.18em] text-gop">NJ-07</span>
      </button>

      <div className="hidden h-6 w-px bg-hairline sm:block" />

      <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
        {r.candidates.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: partyOf(c.party).base }}
              aria-hidden
            />
            <span className="truncate text-[12px] text-ink">{c.name}</span>
            <span className="font-mono text-[10px] text-ink-3">({c.party})</span>
          </span>
        ))}
        <span className="text-[11px] text-ink-3">·</span>
        <a
          href={r.rating.url}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-hairline bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-2 hover:text-ink"
          title={`${r.rating.by}: ${r.rating.label}`}
        >
          {r.rating.label}
        </a>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {last ? (
          <span
            className="hidden font-mono text-[11px] tabular-nums text-ink-3 lg:inline"
            title={`Certified 2024 result across the ${last.municipalities} municipalities that voted on a NJ-07 ballot`}
          >
            2024:{' '}
            <span style={{ color: last.net > 0 ? PARTY.R.bright : PARTY.D.bright }}>
              {last.net > 0 ? 'R' : 'D'}+{Math.abs(last.margin).toFixed(1)}
            </span>
          </span>
        ) : null}

        <span
          className="font-mono text-[11px] tabular-nums text-ink-2"
          title={`Election day ${shortDate(r.electionDay)}`}
        >
          {days > 0 ? `${days} days out` : days === 0 ? 'Election day' : 'Election past'}
        </span>

        <Chip tone="warn" title="The candidate roster is hand-authored; certified returns are not">
          roster {race.meta.verifiedThrough}
        </Chip>

        <button
          onClick={() => setPalette(true)}
          className="rounded border border-hairline bg-white/5 px-2 py-1 font-mono text-[10px] text-ink-3 hover:text-ink"
        >
          ⌘K
        </button>
        <button
          onClick={() => setProvenance(true)}
          className="rounded border border-hairline bg-white/5 px-2 py-1 text-[11px] text-ink-2 hover:text-ink"
        >
          Sources
        </button>
      </div>
    </header>
  );
}
