/** Top chrome: identity, the countdown, and where chamber control stands. */
import { baselineRating, chamberMath } from '../lib/analysis';
import { daysUntil } from '../lib/format';
import { PARTY } from '../lib/palette';
import { useUI } from '../lib/store';
import type { RacesFile, ResultsFile } from '../lib/types';

export default function Header({
  races,
  results,
}: {
  races: RacesFile;
  results: ResultsFile;
}) {
  const { setPalette, setProvenance } = useUI();
  const days = daysUntil(races.meta.electionDay);

  const ratings = races.races.map((r) =>
    baselineRating({
      state: results.states[r.stateFips],
      incumbentParty: r.seatHolder.party,
      open: r.open,
      appointed: r.seatHolder.appointed,
    }),
  );
  const holdover = (races.meta as unknown as { holdover: { D: number; R: number; I: number } })
    .holdover ?? { D: 0, R: 0, I: 0 };
  const math = chamberMath(
    ratings.map((r) => ({ favored: r?.favored ?? null })),
    holdover,
  );

  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-hairline bg-plane px-4 py-2.5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[15px] font-bold tracking-[0.22em] text-ink">POLISOF</span>
        <span className="hidden text-[10px] uppercase tracking-[0.16em] text-ink-3 sm:inline">
          US Senate · {races.meta.cycle}
        </span>
      </div>

      <div className="hidden items-baseline gap-1.5 md:flex">
        <span className="font-mono text-[19px] font-semibold tabular-nums leading-none text-ink">
          {days > 0 ? days : 0}
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
          days to {new Date(`${races.meta.electionDay}T00:00:00Z`).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          })}
        </span>
      </div>

      <ChamberBar math={math} />

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={() => setProvenance(true)}
          className="rounded border border-hairline px-2 py-1 text-[10px] uppercase tracking-wider text-ink-3 transition hover:border-white/25 hover:text-ink"
        >
          Sources
        </button>
        <button
          onClick={() => setPalette(true)}
          className="flex items-center gap-1.5 rounded border border-hairline px-2 py-1 text-[10px] uppercase tracking-wider text-ink-3 transition hover:border-white/25 hover:text-ink"
        >
          Search
          <kbd className="rounded bg-white/10 px-1 font-mono text-[9px] text-ink-2">⌘K</kbd>
        </button>
      </div>
    </header>
  );
}

/**
 * Seats, not percentages. The bar shows the holdover floor each side starts
 * from, the seats the baseline leans their way, and the tossups that decide it
 * — with the 51-seat majority line drawn where it actually falls.
 */
function ChamberBar({
  math,
}: {
  math: ReturnType<typeof chamberMath>;
}) {
  const total = 100;
  const seg = (n: number) => `${(n / total) * 100}%`;
  const leanD = math.projectedD - math.holdoverD;
  const leanR = math.projectedR - math.holdoverR;

  return (
    <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
      <div className="relative h-[22px] min-w-0 flex-1 overflow-hidden rounded border border-hairline bg-white/[0.03]">
        <div className="flex h-full w-full">
          <Seg w={seg(math.holdoverD)} color={PARTY.D.deep} label={`${math.holdoverD} D held over`} />
          <Seg w={seg(leanD)} color={PARTY.D.base} label={`${leanD} D favoured`} />
          <Seg w={seg(math.tossups)} color="#333a4a" label={`${math.tossups} tossup`} />
          <Seg w={seg(math.holdoverI)} color={PARTY.I.base} label={`${math.holdoverI} independent`} />
          <Seg w={seg(leanR)} color={PARTY.R.base} label={`${leanR} R favoured`} />
          <Seg w={seg(math.holdoverR)} color={PARTY.R.deep} label={`${math.holdoverR} R held over`} />
        </div>
        <div
          className="absolute inset-y-0 w-px bg-white/70"
          style={{ left: '51%' }}
          title="51 seats — majority"
        />
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <span className="font-mono text-[10px] font-semibold tabular-nums text-white/90 drop-shadow">
            {math.projectedD}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-white/60">
            {math.tossups} tossup
          </span>
          <span className="font-mono text-[10px] font-semibold tabular-nums text-white/90 drop-shadow">
            {math.projectedR}
          </span>
        </div>
      </div>
      <span className="shrink-0 text-[9px] uppercase leading-tight tracking-wider text-ink-3">
        Baseline
        <br />
        seat count
      </span>
    </div>
  );
}

function Seg({ w, color, label }: { w: string; color: string; label: string }) {
  return <div style={{ width: w, background: color }} title={label} className="h-full" />;
}
