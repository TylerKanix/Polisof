/**
 * Layer switcher and legend.
 *
 * The legend is not decoration: it states what the active layer measures, what
 * the ends of the ramp mean, and where the numbers came from. A choropleth
 * without that is a mood board.
 */
import { useMemo, useState } from 'react';
import { METRICS, METRIC_BY_ID } from '../lib/metrics';
import { DEM_ARM, GOP_ARM, NEUTRAL, NO_DATA, SEQUENTIAL } from '../lib/palette';
import { useUI } from '../lib/store';

export default function LayerControls() {
  const { metric, setMetric, focusState, nationalCounties, toggleNationalCounties, showTowns, toggleTowns } =
    useUI();
  const [open, setOpen] = useState(false);
  const active = METRIC_BY_ID[metric] ?? METRICS[0];

  const grouped = useMemo(() => {
    const g = new Map<string, typeof METRICS>();
    for (const m of METRICS) {
      if (!g.has(m.group)) g.set(m.group, []);
      g.get(m.group)!.push(m);
    }
    return [...g.entries()];
  }, []);

  const swatches =
    active.kind === 'diverging'
      ? [...[...DEM_ARM].reverse(), NEUTRAL, ...GOP_ARM]
      : SEQUENTIAL[active.ramp ?? 'blue'];

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 w-[320px]">
      {open && (
        <div className="mb-2 max-h-[46vh] overflow-y-auto rounded-lg border border-white/12 bg-plane/95 p-2 shadow-lift backdrop-blur">
          {grouped.map(([group, metrics]) => (
            <div key={group} className="mb-2 last:mb-0">
              <div className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                {group}
              </div>
              {metrics.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setMetric(m.id);
                    setOpen(false);
                  }}
                  className={`block w-full rounded px-2 py-1.5 text-left transition ${
                    m.id === metric ? 'bg-white/10' : 'hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="text-[11px] text-ink">{m.label}</div>
                  <div className="text-[9.5px] leading-snug text-ink-3">{m.description}</div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-white/12 bg-plane/95 shadow-lift backdrop-blur">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[9px] uppercase tracking-[0.16em] text-ink-3">
              County layer
            </span>
            <span className="block truncate text-[12px] font-medium text-ink">{active.label}</span>
          </span>
          <span className="shrink-0 font-mono text-[10px] text-ink-3">{open ? '▾' : '▸'}</span>
        </button>

        <div className="px-3 pb-2">
          <div className="flex h-2.5 overflow-hidden rounded" style={{ gap: 1 }}>
            {swatches.map((c, i) => (
              <div key={`${c}-${i}`} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-ink-3">
            <span>{active.legend[0]}</span>
            {active.kind === 'diverging' && <span className="text-ink-3/60">even</span>}
            <span>{active.legend[1]}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-ink-3">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm border border-white/10"
              style={{ background: NO_DATA }}
            />
            no data
            <span className="ml-auto truncate" title={active.source}>
              {active.source}
            </span>
          </div>
        </div>

        <div className="flex gap-1 border-t border-hairline px-2 py-1.5">
          <Toggle
            on={focusState ? showTowns : nationalCounties}
            onClick={focusState ? toggleTowns : toggleNationalCounties}
            label={focusState ? 'Towns' : 'All counties'}
          />
          <span className="ml-auto self-center pr-1 text-[9px] text-ink-3">
            {focusState ? 'Esc to zoom out' : 'Click a state to zoom'}
          </span>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded border px-2 py-1 text-[9.5px] uppercase tracking-wider transition ${
        on ? 'border-white/25 bg-white/10 text-ink' : 'border-hairline text-ink-3 hover:text-ink-2'
      }`}
    >
      {on ? '●' : '○'} {label}
    </button>
  );
}
