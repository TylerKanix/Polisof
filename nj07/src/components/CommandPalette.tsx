/** ⌘K — every town, county and layer in one list. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { metricsFor } from '../lib/metrics';
import { useUI } from '../lib/store';
import type { DistrictFile } from '../lib/types';

type Item =
  | { kind: 'town'; id: string; label: string; hint: string }
  | { kind: 'layer'; id: string; label: string; hint: string };

export default function CommandPalette({ district }: { district: DistrictFile }) {
  const municipalities = district.municipalities;
  const { paletteOpen, setPalette, select, setMetric, setHover } = useUI();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
      if (e.key === 'Escape') setPalette(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette]);

  useEffect(() => {
    if (paletteOpen) {
      setQuery('');
      setCursor(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [paletteOpen]);

  const items = useMemo<Item[]>(() => {
    const towns: Item[] = municipalities.map((m) => ({
      kind: 'town',
      id: m.geoid,
      label: m.name,
      hint: `${m.county} County${m.inDistrict === 'split' ? ' · split' : ''}`,
    }));
    const layers: Item[] = metricsFor(district).map((m) => ({
      kind: 'layer',
      id: m.id,
      label: m.label,
      hint: `Layer · ${m.group}`,
    }));
    return [...towns, ...layers];
  }, [municipalities, district]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 40);
    return items
      .map((i) => {
        const label = i.label.toLowerCase();
        const hint = i.hint.toLowerCase();
        const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : hint.includes(q) ? 2 : -1;
        return { i, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score || a.i.label.localeCompare(b.i.label))
      .slice(0, 40)
      .map((x) => x.i);
  }, [items, query]);

  if (!paletteOpen) return null;

  const run = (item: Item) => {
    if (item.kind === 'town') {
      select(item.id);
      setHover(null);
    } else setMetric(item.id);
    setPalette(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 pt-[12vh] backdrop-blur-sm"
      onClick={() => setPalette(false)}
    >
      <div
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-lg border border-hairline bg-surface shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(results.length - 1, c + 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(0, c - 1));
            }
            if (e.key === 'Enter' && results[cursor]) run(results[cursor]);
          }}
          placeholder="Search 94 municipalities and every map layer…"
          className="w-full border-b border-hairline bg-transparent px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
        />
        <div className="max-h-[52vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-ink-3">Nothing matches.</div>
          ) : (
            results.map((item, i) => (
              <button
                key={`${item.kind}-${item.id}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => run(item)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                  i === cursor ? 'bg-white/[0.08]' : ''
                }`}
              >
                <span
                  className={`w-10 shrink-0 font-mono text-[9px] uppercase tracking-wider ${
                    item.kind === 'town' ? 'text-ink-3' : 'text-dem/80'
                  }`}
                >
                  {item.kind === 'town' ? 'town' : 'layer'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.label}</span>
                <span className="shrink-0 truncate text-[10px] text-ink-3">{item.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
