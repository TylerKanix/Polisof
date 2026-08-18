/** The card that follows the pointer across the map. */
import {
  HOUSE_24,
  PRES_24,
  overperformance,
  turnoutRate,
  twoParty,
} from '../lib/analysis';
import { DASH, int, pct, signedPct } from '../lib/format';
import type { Metric } from '../lib/metrics';
import { MarginBar } from './primitives';
import type { Municipality } from '../lib/types';

export default function HoverCard({
  muni,
  metric,
  x,
  y,
  width,
  height,
}: {
  muni: Municipality;
  metric: Metric;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const CARD_W = 268;
  const CARD_H = 208;
  // Flip the card rather than let it run off the stage.
  const left = x + CARD_W + 24 > width ? x - CARD_W - 16 : x + 16;
  const top = Math.min(Math.max(8, y - 12), Math.max(8, height - CARD_H - 8));

  const house = twoParty(muni.results[HOUSE_24]);
  const pres = twoParty(muni.results[PRES_24]);
  const split = overperformance(muni, HOUSE_24, PRES_24);
  const turnout = turnoutRate(muni);
  const value = metric.value(muni);

  return (
    <div
      className="pointer-events-none absolute z-30 w-[268px] rounded-lg border border-hairline bg-surface/97 p-3 shadow-lift backdrop-blur"
      style={{ left, top, animation: 'fade 120ms ease-out' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="truncate text-[13px] font-semibold text-ink">{muni.name}</div>
        <div className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-3">
          {muni.county}
        </div>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-2 border-y border-hairline py-1.5">
        <span className="text-[10px] uppercase tracking-[0.13em] text-ink-3">{metric.group}</span>
        <span className="font-mono text-[15px] tabular-nums text-ink">{metric.format(value)}</span>
      </div>

      <div className="mt-2 space-y-2">
        <Row
          label="2024 House"
          margin={house?.margin ?? null}
          detail={
            house
              ? `${int(house.r)} R · ${int(house.d)} D`
              : muni.results[HOUSE_24]
                ? 'no two-party vote'
                : 'voted in another district'
          }
        />
        <Row
          label="2024 President"
          margin={pres?.margin ?? null}
          detail={pres ? `${int(pres.r)} R · ${int(pres.d)} D` : DASH}
        />
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-hairline pt-2 text-[10px]">
        <Mini label="Ticket split" value={split === null ? DASH : `${signedPct(split)}`} />
        <Mini label="Turnout" value={pct(turnout, 0)} />
        <Mini label="Ballots" value={int(muni.turnout.g2024?.ballots ?? null)} />
      </div>

      {muni.inDistrict === 'split' ? (
        <div className="mt-2 rounded border border-dashed border-hairline px-2 py-1 text-[10px] leading-snug text-ink-3">
          {(muni.districtShare * 100).toFixed(0)}% of this town's House vote was cast on a NJ-07
          ballot; the rest belongs to{' '}
          {muni.otherDistricts.map((o) => `NJ-${String(o.cd).padStart(2, '0')}`).join(', ')}.
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  margin,
  detail,
}: {
  label: string;
  margin: number | null;
  detail: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.13em] text-ink-3">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-ink-2">
          {margin === null
            ? DASH
            : `${margin > 0 ? 'R+' : 'D+'}${Math.abs(margin).toFixed(1)}`}
        </span>
      </div>
      <div className="mt-1">
        <MarginBar margin={margin} height={5} />
      </div>
      <div className="mt-0.5 font-mono text-[9px] text-ink-3">{detail}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[9px] uppercase tracking-[0.1em] text-ink-3">{label}</div>
      <div className="truncate font-mono text-[11px] tabular-nums text-ink">{value}</div>
    </div>
  );
}
