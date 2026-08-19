/** Every municipality, ranked by whatever the map is currently showing. */
import { useMemo } from 'react';
import { colorFor, domainOf, METRIC_BY_ID, METRICS } from '../lib/metrics';
import { shortNames } from '../lib/names';
import { useUI } from '../lib/store';
import type { Municipality } from '../lib/types';

export default function TownRail({ municipalities }: { municipalities: Municipality[] }) {
  const { metric: metricId, selected, hover, select, setHover, sort, setSort } = useUI();
  const metric = METRIC_BY_ID.get(metricId) ?? METRICS[0];
  const domain = useMemo(() => domainOf(metric, municipalities), [metric, municipalities]);
  const shortNameOf = useMemo(() => shortNames(municipalities), [municipalities]);

  const rows = useMemo(() => {
    const list = [...municipalities];
    if (sort === 'name') return list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'size') {
      return list.sort(
        (a, b) => (b.turnout.g2024?.ballots ?? 0) - (a.turnout.g2024?.ballots ?? 0),
      );
    }
    return list.sort((a, b) => {
      const av = metric.value(a);
      const bv = metric.value(b);
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });
  }, [municipalities, metric, sort]);

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-hairline bg-plane lg:flex">
      <div className="flex items-center gap-1 border-b border-hairline px-2 py-1.5">
        {(['metric', 'size', 'name'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`rounded px-1.5 py-1 text-[10px] uppercase tracking-wider transition-colors ${
              sort === s ? 'bg-white/10 text-ink' : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            {s === 'metric' ? 'layer' : s === 'size' ? 'votes' : 'a–z'}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-ink-3">{rows.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((m) => {
          const v = metric.value(m);
          const isActive = selected === m.geoid || hover === m.geoid;
          return (
            <button
              key={m.geoid}
              onClick={() => select(selected === m.geoid ? null : m.geoid)}
              onMouseEnter={() => setHover(m.geoid)}
              onMouseLeave={() => setHover(null)}
              className={`flex w-full items-center gap-2 border-b border-hairline/60 px-2.5 py-[7px] text-left transition-colors ${
                isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.03]'
              }`}
            >
              <span
                className="h-4 w-1 shrink-0 rounded-sm"
                style={{ background: colorFor(metric, v, domain) }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] leading-tight text-ink">
                  {shortNameOf.get(m.geoid) ?? m.name}
                  {m.inDistrict === 'split' ? (
                    <span className="ml-1 font-mono text-[9px] text-ink-3">◧</span>
                  ) : null}
                </span>
                <span className="block truncate text-[9px] uppercase tracking-wider text-ink-3">
                  {m.county}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-2">
                {metric.format(v)}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
