import { useEffect, useMemo } from 'react';
import CommandPalette from './components/CommandPalette';
import CountyPanel from './components/CountyPanel';
import Dossier from './components/Dossier';
import Header from './components/Header';
import LayerControls from './components/LayerControls';
import MapStage from './components/MapStage';
import Provenance from './components/Provenance';
import RaceRail from './components/RaceRail';
import {
  loadCensus,
  loadCountiesTopo,
  loadManifest,
  loadPhotoManifest,
  loadRaces,
  loadResults,
  loadStateMeta,
  loadStatesTopo,
  useAsync,
} from './lib/data';
import { useUI } from './lib/store';

export default function App() {
  const races = useAsync('races', loadRaces);
  const results = useAsync('results', loadResults);
  const census = useAsync('census', loadCensus);
  const statesTopo = useAsync('states-topo', loadStatesTopo);
  const countiesTopo = useAsync('counties-topo', loadCountiesTopo);
  const stateMeta = useAsync('state-meta', loadStateMeta);
  const manifest = useAsync('manifest', loadManifest);
  const photoManifest = useAsync('photos', loadPhotoManifest);

  const { focusState, selectedCounty } = useUI();

  const photos = useMemo(
    () => new Set(photoManifest.data?.available ?? []),
    [photoManifest.data],
  );

  const loading =
    races.loading ||
    results.loading ||
    census.loading ||
    statesTopo.loading ||
    countiesTopo.loading ||
    stateMeta.loading;

  const error =
    races.error ?? results.error ?? census.error ?? statesTopo.error ?? countiesTopo.error;

  useEffect(() => {
    document.title = focusState
      ? `${stateMeta.data?.[focusState]?.name ?? 'State'} — Polisof`
      : 'Polisof — 2026 US Senate';
  }, [focusState, stateMeta.data]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-void px-6">
        <div className="max-w-md rounded-lg border border-red-500/30 bg-red-500/[0.06] p-5">
          <h1 className="mb-2 font-mono text-sm font-semibold text-red-300">Data failed to load</h1>
          <p className="mb-3 text-[12px] leading-relaxed text-ink-2">{error.message}</p>
          <p className="text-[11px] leading-relaxed text-ink-3">
            The static datasets have not been built yet. Run{' '}
            <code className="rounded bg-black/50 px-1 py-0.5 text-ink-2">npm run data</code> and
            reload.
          </p>
        </div>
      </div>
    );
  }

  if (loading || !races.data || !results.data || !census.data || !stateMeta.data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-void">
        <div className="font-mono text-[13px] tracking-[0.28em] text-ink-2">POLISOF</div>
        <div className="h-px w-40 overflow-hidden bg-white/10">
          <div className="h-full w-1/3 animate-[slide_1.1s_ease-in-out_infinite] bg-white/50" />
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
          loading election data
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-void text-ink">
      <Header races={races.data} results={results.data} />

      <div className="flex min-h-0 flex-1">
        <RaceRail races={races.data} results={results.data} />

        <main className="relative min-w-0 flex-1 bg-plane">
          <MapStage
            statesTopo={statesTopo.data}
            countiesTopo={countiesTopo.data}
            stateMeta={stateMeta.data}
            races={races.data}
            results={results.data}
            census={census.data}
            photos={photos}
          />
          <LayerControls />
        </main>

        {focusState && (
          <aside className="flex w-[400px] shrink-0 border-l border-hairline bg-plane">
            {selectedCounty ? (
              <div className="flex w-full flex-col">
                <CountyPanel results={results.data} census={census.data} />
              </div>
            ) : (
              <div className="w-full">
                <Dossier
                  races={races.data}
                  results={results.data}
                  census={census.data}
                  photos={photos}
                />
              </div>
            )}
          </aside>
        )}
      </div>

      <CommandPalette races={races.data} results={results.data} />
      <Provenance manifest={manifest.data} races={races.data} />
    </div>
  );
}
