/** The left rail: every seat on the ballot, ordered by how close it is. */
import { useMemo, useState } from 'react';
import { baselineRating, fmtMargin } from '../lib/analysis';
import { headToHead } from '../lib/candidate';
import { RATING_STYLE, partyOf } from '../lib/palette';
import { useUI } from '../lib/store';
import type { RacesFile, ResultsFile } from '../lib/types';
import { MarginBar } from './primitives';

type Sort = 'competitive' | 'alpha' | 'watch';

export default function RaceRail({
  races,
  results,
}: {
  races: RacesFile;
  results: ResultsFile;
}) {
  const { focusState, focus, hoverState, setHoverState, watchlist } = useUI();
  const [sort, setSort] = useState<Sort>('competitive');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const list = races.races.map((race) => ({
      race,
      baseline: baselineRating({
        state: results.states[race.stateFips],
        incumbentParty: race.seatHolder.party,
        open: race.open,
        appointed: race.seatHolder.appointed,
      }),
    }));

    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          ({ race }) =>
            race.stateName.toLowerCase().includes(q) ||
            race.state.toLowerCase() === q ||
            race.candidates.some((c) => c.name.toLowerCase().includes(q)),
        )
      : list;

    if (sort === 'watch') {
      return filtered.filter(({ race }) => watchlist.includes(race.id));
    }
    if (sort === 'alpha') {
      return [...filtered].sort((a, b) => a.race.stateName.localeCompare(b.race.stateName));
    }
    return [...filtered].sort(
      (a, b) => (b.baseline?.competitiveness ?? 0) - (a.baseline?.competitiveness ?? 0),
    );
  }, [races, results, sort, query, watchlist]);

  return (
    <aside className="flex h-full w-[268px] shrink-0 flex-col border-r border-hairline bg-plane">
      <div className="shrink-0 space-y-2 border-b border-hairline px-3 py-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter states or candidates"
          className="w-full rounded border border-hairline bg-black/30 px-2 py-1.5 text-[11px] text-ink placeholder:text-ink-3 focus:border-white/30 focus:outline-none"
        />
        <div className="flex gap-1">
          {(
            [
              ['competitive', 'Closest'],
              ['alpha', 'A–Z'],
              ['watch', `Watch ${watchlist.length ? `(${watchlist.length})` : ''}`],
            ] as [Sort, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className={`flex-1 rounded border px-1.5 py-1 text-[9.5px] uppercase tracking-wider transition ${
                sort === id
                  ? 'border-white/25 bg-white/10 text-ink'
                  : 'border-hairline text-ink-3 hover:text-ink-2'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 && (
          <p className="px-3 py-4 text-[11px] text-ink-3">
            {sort === 'watch' ? 'No seats on your watchlist yet.' : 'No match.'}
          </p>
        )}
        {rows.map(({ race, baseline }) => {
          const active = focusState === race.stateFips;
          const hovered = hoverState === race.stateFips;
          const pair = headToHead(race, 2);
          const rating = baseline ? RATING_STYLE[baseline.rating] : null;
          return (
            <button
              key={race.id}
              onMouseEnter={() => setHoverState(race.stateFips)}
              onMouseLeave={() => setHoverState(null)}
              onClick={() => focus(active ? null : race.stateFips)}
              className={`block w-full border-b border-hairline/50 px-3 py-2 text-left transition ${
                active ? 'bg-white/[0.07]' : hovered ? 'bg-white/[0.035]' : 'hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="font-mono text-[10px] text-ink-3">{race.state}</span>
                  <span className="truncate text-[12px] font-medium text-ink">
                    {race.stateName}
                  </span>
                  {race.special && (
                    <span className="shrink-0 font-mono text-[8.5px] uppercase text-amber-400/80">
                      SP
                    </span>
                  )}
                  {race.open && (
                    <span className="shrink-0 font-mono text-[8.5px] uppercase text-amber-400/80">
                      OPEN
                    </span>
                  )}
                </span>
                {rating && (
                  <span
                    className="shrink-0 font-mono text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: rating.fill }}
                  >
                    {rating.label}
                  </span>
                )}
              </div>

              <div className="mt-1.5">
                <MarginBar margin={baseline?.expected ?? null} height={4} max={30} />
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="flex min-w-0 gap-1.5 truncate">
                  {pair.map((c) => {
                    const p = partyOf(c.party);
                    return (
                      <span key={c.id} className="truncate text-[10px]" style={{ color: p.bright }}>
                        {c.name.split(' ').slice(-1)[0]}
                      </span>
                    );
                  })}
                  {!pair.length && <span className="text-[10px] text-ink-3">Field unverified</span>}
                </span>
                <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-ink-3">
                  {fmtMargin(baseline?.expected ?? null)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-hairline px-3 py-1.5 text-[9px] leading-snug text-ink-3">
        {races.meta.races} seats · roster verified through {races.meta.verifiedThrough}
      </div>
    </aside>
  );
}
