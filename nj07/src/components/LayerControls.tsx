/** Layer picker and legend, anchored to the map. */
import { useMemo, useState } from 'react';
import { METRICS, colorFor, domainOf, type Metric } from '../lib/metrics';
import { DEM_ARM, GOP_ARM, NEUTRAL, NO_DATA, SEQUENTIAL } from '../lib/palette';
import { useUI } from '../lib/store';
import type { Municipality } from '../lib/types';
import { districtColor } from '../lib/metrics';
import { districtIn, HOUSE_18 } from '../lib/analysis';

export default function LayerControls({ municipalities }: { municipalities: Municipality[] }) {
  const { metric: metricId, setMetric, labels, toggleLabels } = useUI();
  const [open, setOpen] = useState(false);
  const metric = METRICS.find((m) => m.id === metricId) ?? METRICS[0];

  const groups = useMemo(() => {
    const g = new Map<string, Metric[]>();
    for (const m of METRICS) {
      if (!g.has(m.group)) g.set(m.group, []);
      g.get(m.group)!.push(m);
    }
    return [...g];
  }, []);

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 w-[248px] sm:bottom-4 sm:left-4 sm:w-[292px]">
      <div className="pointer-events-auto overflow-hidden rounded-lg border border-hairline bg-surface/95 shadow-lift backdrop-blur">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-white/[0.04]"
        >
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-[0.18em] text-ink-3">Layer</div>
            <div className="truncate text-[12px] font-medium text-ink">{metric.label}</div>
          </div>
          <span className="shrink-0 font-mono text-[10px] text-ink-3">{open ? '▾' : '▸'}</span>
        </button>

        {open ? (
          <div className="max-h-[46vh] overflow-y-auto border-t border-hairline">
            {groups.map(([group, list]) => (
              <div key={group} className="px-2 py-2">
                <div className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-3">
                  {group}
                </div>
                {list.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMetric(m.id);
                      setOpen(false);
                    }}
                    className={`block w-full rounded px-2 py-1.5 text-left transition-colors ${
                      m.id === metricId ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="text-[12px] leading-tight text-ink">{m.label}</div>
                    <div className="text-[10px] leading-tight text-ink-3">{m.hint}</div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        <div className="border-t border-hairline px-3 py-2.5">
          <Legend metric={metric} municipalities={municipalities} />
          {metric.note ? (
            <p className="mt-2 text-[10px] leading-snug text-ink-3">{metric.note}</p>
          ) : null}
          <div className="mt-2.5 flex items-center justify-between border-t border-hairline pt-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-ink-3">
              <input
                type="checkbox"
                checked={labels}
                onChange={toggleLabels}
                className="h-3 w-3 accent-dem"
              />
              Town names
            </label>
            <span className="flex items-center gap-1.5 text-[10px] text-ink-3">
              <svg width="12" height="12" aria-hidden>
                <rect width="12" height="12" fill="rgba(255,255,255,0.1)" />
                <line x1="0" y1="12" x2="12" y2="0" stroke="rgba(255,255,255,0.5)" strokeWidth="1.4" />
              </svg>
              split town
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ metric, municipalities }: { metric: Metric; municipalities: Municipality[] }) {
  const domain = domainOf(metric, municipalities);

  if (metric.kind === 'categorical') {
    const seen = new Map<number, number>();
    let missing = 0;
    for (const m of municipalities) {
      const cd = districtIn(m, HOUSE_18);
      if (cd === null) missing++;
      else seen.set(cd, (seen.get(cd) ?? 0) + 1);
    }
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {[...seen].sort((a, b) => b[1] - a[1]).map(([cd, n]) => (
          <span key={cd} className="flex items-center gap-1.5 text-[10px] text-ink-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: districtColor(cd) }} />
            NJ-{String(cd).padStart(2, '0')}
            <span className="text-ink-3">{n}</span>
          </span>
        ))}
        {missing ? (
          <span
            className="flex items-center gap-1.5 text-[10px] text-ink-3"
            title="No 2018 House race appears for this town in the transcribed returns"
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: NO_DATA }} />
            no race on file
            <span className="text-ink-3">{missing}</span>
          </span>
        ) : null}
      </div>
    );
  }

  const swatches =
    metric.kind === 'sequential'
      ? SEQUENTIAL[metric.ramp ?? 'blue']
      : [...[...DEM_ARM].slice(1).reverse(), NEUTRAL, ...[...GOP_ARM].slice(1)];

  const [lo, hi] = domain;
  const ends: [string, string] =
    metric.poles ??
    (metric.kind === 'sequential'
      ? [metric.format(lo), metric.format(hi)]
      : ['Democratic', 'Republican']);

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-sm">
        {swatches.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-ink-3">
        <span>{ends[0]}</span>
        {metric.kind === 'sequential' ? (
          <span className="text-ink-3/70">
            {metric.format(lo)} – {metric.format(hi)}
          </span>
        ) : (
          <span className="text-ink-3/70">
            {metric.span ? `±${metric.span.toLocaleString('en-US')}` : 'even'}
          </span>
        )}
        <span>{ends[1]}</span>
      </div>
    </div>
  );
}

export { colorFor };
