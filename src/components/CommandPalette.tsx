/** ⌘K search across seats, candidates and counties. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUI } from '../lib/store';
import { partyOf } from '../lib/palette';
import type { RacesFile, ResultsFile } from '../lib/types';

interface Item {
  id: string;
  kind: 'race' | 'candidate' | 'county';
  label: string;
  sub: string;
  stateFips: string;
  countyFips?: string;
  accent?: string;
}

export default function CommandPalette({
  races,
  results,
}: {
  races: RacesFile;
  results: ResultsFile;
}) {
  const { paletteOpen, setPalette, focus, selectCounty } = useUI();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const r of races.races) {
      out.push({
        id: `race-${r.id}`,
        kind: 'race',
        label: `${r.stateName}${r.special ? ' — Special' : ''}`,
        sub: `Senate · Class ${r.seatClass} · ${r.open ? 'open seat' : r.seatHolder.name}`,
        stateFips: r.stateFips,
      });
      for (const c of r.candidates) {
        out.push({
          id: `cand-${c.id}`,
          kind: 'candidate',
          label: c.name,
          sub: `${partyOf(c.party).label} · ${r.stateName}`,
          stateFips: r.stateFips,
          accent: partyOf(c.party).bright,
        });
      }
    }
    for (const [fips, c] of Object.entries(results.counties)) {
      out.push({
        id: `county-${fips}`,
        kind: 'county',
        label: c.n,
        sub: `County · FIPS ${fips}`,
        stateFips: c.s,
        countyFips: fips,
      });
    }
    return out;
  }, [races, results]);

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items.filter((i) => i.kind === 'race').slice(0, 12);
    const scored = items
      .map((i) => {
        const l = i.label.toLowerCase();
        if (l === query) return { i, s: 0 };
        if (l.startsWith(query)) return { i, s: 1 };
        if (l.includes(query)) return { i, s: 2 };
        if (i.sub.toLowerCase().includes(query)) return { i, s: 3 };
        return null;
      })
      .filter((x): x is { i: Item; s: number } => x !== null)
      // Races before candidates before counties at equal match quality.
      .sort((a, b) => a.s - b.s || rank(a.i.kind) - rank(b.i.kind));
    return scored.slice(0, 40).map((x) => x.i);
  }, [q, items]);

  useEffect(() => setCursor(0), [q]);

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
      setQ('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [paletteOpen]);

  if (!paletteOpen) return null;

  const choose = (item: Item) => {
    focus(item.stateFips);
    if (item.countyFips) setTimeout(() => selectCounty(item.countyFips!), 60);
    setPalette(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm"
      onClick={() => setPalette(false)}
    >
      <div
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-lg border border-white/15 bg-plane shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, matches.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            }
            if (e.key === 'Enter' && matches[cursor]) choose(matches[cursor]);
          }}
          placeholder="Search seats, candidates, counties…"
          className="w-full border-b border-hairline bg-transparent px-4 py-3 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <div className="max-h-[52vh] overflow-y-auto py-1">
          {matches.map((m, i) => (
            <button
              key={m.id}
              onMouseEnter={() => setCursor(i)}
              onClick={() => choose(m)}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                i === cursor ? 'bg-white/10' : ''
              }`}
            >
              <span
                className="w-14 shrink-0 font-mono text-[9px] uppercase tracking-wider text-ink-3"
              >
                {m.kind}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-[12.5px] text-ink"
                  style={m.accent ? { color: m.accent } : undefined}
                >
                  {m.label}
                </span>
                <span className="block truncate text-[10px] text-ink-3">{m.sub}</span>
              </span>
            </button>
          ))}
          {!matches.length && (
            <p className="px-4 py-6 text-center text-[11px] text-ink-3">Nothing matches “{q}”.</p>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-hairline px-4 py-1.5 text-[9px] uppercase tracking-wider text-ink-3">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

const rank = (k: Item['kind']) => (k === 'race' ? 0 : k === 'candidate' ? 1 : 2);
