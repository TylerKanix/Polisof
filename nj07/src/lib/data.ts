/** Dataset loading. Every file is fetched once and memoised. */
import { useEffect, useState } from 'react';
import type { CountyReturnsFile, DistrictFile, Frame, Manifest, RaceFile } from './types';

const BASE = `${import.meta.env.BASE_URL ?? '/'}data`;
const cache = new Map<string, Promise<unknown>>();

/** The standalone build inlines every dataset; when present it is authoritative. */
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

export const loadDistrict = () => loadJSON<DistrictFile>('district.json');
export const loadRace = () => loadJSON<RaceFile>('race.json');
export const loadFrame = () => loadJSON<Frame>('geo/frame.json');
export const loadManifest = () => loadJSON<Manifest>('manifest.json');
export const loadCountyReturns = () => loadJSON<CountyReturnsFile>('county-returns.json');
// TopoJSON is typed loosely; topojson-client validates the shape on use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const loadTopo = () => loadJSON<any>('geo/munis.json');

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function useAsync<T>(key: string, load: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
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
