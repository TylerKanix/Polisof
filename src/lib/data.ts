/**
 * Dataset loading.
 *
 * The heavy files (county geometry, county census) are fetched once, on first
 * use, and memoised — a state zoom should never re-download 800 KB of arcs.
 */
import { useEffect, useState } from 'react';
import type {
  CensusFile,
  Manifest,
  PlacesFile,
  RacesFile,
  ResultsFile,
  StateMeta,
} from './types';

const BASE = `${import.meta.env.BASE_URL ?? '/'}data`;

const cache = new Map<string, Promise<unknown>>();

/**
 * The standalone build (`npm run standalone`) inlines every dataset here so
 * the page works as one file with no network at all. When that bundle is
 * present it is authoritative; otherwise datasets are fetched as normal.
 */
function embedded<T>(path: string): T | undefined {
  const bag = (globalThis as { __POLISOF_DATA__?: Record<string, unknown> }).__POLISOF_DATA__;
  return bag?.[path] as T | undefined;
}

export function loadJSON<T>(path: string): Promise<T> {
  const inline = embedded<T>(path);
  if (inline !== undefined) return Promise.resolve(inline);

  const url = `${BASE}/${path}`;
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${path} (${r.status})`);
        return r.json();
      }),
    );
  }
  return cache.get(url) as Promise<T>;
}

export const loadRaces = () => loadJSON<RacesFile>('races.json');
export const loadResults = () => loadJSON<ResultsFile>('county-results.json');
export const loadCensus = () => loadJSON<CensusFile>('county-census.json');
export const loadStateMeta = () => loadJSON<Record<string, StateMeta>>('geo/state-meta.json');
export const loadManifest = () => loadJSON<Manifest>('manifest.json');
export const loadPlaces = (stateFips: string) => loadJSON<PlacesFile>(`places/${stateFips}.json`);
export const loadPhotoManifest = () =>
  loadJSON<{ available: string[]; unavailable: string[] }>('photo-manifest.json');

// TopoJSON is typed loosely here; topojson-client validates the shape on use.
export const loadStatesTopo = () => loadJSON<any>('geo/states-10m.json');
export const loadCountiesTopo = () => loadJSON<any>('geo/counties-10m.json');

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/** Minimal async hook — no dependency array games, the loader key is the dep. */
export function useAsync<T>(key: string, load: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let live = true;
    setState((s) => (s.data ? s : { ...s, loading: true }));
    load()
      .then((data) => live && setState({ data, error: null, loading: false }))
      .then(undefined, (error: Error) => live && setState({ data: null, error, loading: false }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

/**
 * Optional overlays written by the live connectors. A missing file is the
 * normal state before a sync, not an error — callers get null and render the
 * connector prompt instead.
 */
export function loadOptional<T>(path: string): Promise<T | null> {
  const inline = embedded<T>(path);
  if (inline !== undefined) return Promise.resolve(inline);

  const url = `${BASE}/${path}`;
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    );
  }
  return cache.get(url) as Promise<T | null>;
}

export interface MarketsFile {
  meta: { source: string; syncedAt: string; note: string };
  markets: Record<
    string,
    {
      title: string;
      url: string;
      markets: {
        ticker: string;
        subtitle: string | null;
        lastPrice: number | null;
        yesBid: number | null;
        yesAsk: number | null;
        volume: number | null;
      }[];
    }
  >;
}

export interface AdsFile {
  meta: { syncedAt: string; sources: string[]; caveat: string };
  races: Record<
    string,
    {
      outsideSpending: {
        spender: string | null;
        amount: number | null;
        date: string | null;
        supportOppose: string | null;
        candidate: string | null;
        purpose: string | null;
      }[];
      totals: { outside: number };
    }
  >;
}

export const loadMarkets = () => loadOptional<MarketsFile>('overlays/markets.json');
export const loadAds = () => loadOptional<AdsFile>('overlays/ads.json');
