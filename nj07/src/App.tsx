import { useEffect, useMemo } from 'react';
import CommandPalette from './components/CommandPalette';
import DistrictPanel from './components/DistrictPanel';
import Header from './components/Header';
import MapPane from './components/MapPane';
import Provenance from './components/Provenance';
import TownPanel from './components/TownPanel';
import TownRail from './components/TownRail';
import { loadDistrict, loadFrame, loadManifest, loadRace, loadTopo, useAsync } from './lib/data';
import { useUI } from './lib/store';

export default function App() {
  const district = useAsync('district', loadDistrict);
  const race = useAsync('race', loadRace);
  const topo = useAsync('topo', loadTopo);
  const frame = useAsync('frame', loadFrame);
  const manifest = useAsync('manifest', loadManifest);

  const { selected, select } = useUI();

  const selectedMuni = useMemo(
    () => district.data?.municipalities.find((m) => m.geoid === selected) ?? null,
    [district.data, selected],
  );

  useEffect(() => {
    document.title = selectedMuni ? `${selectedMuni.name} — Polisof NJ-07` : 'Polisof · NJ-07';
  }, [selectedMuni]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selected) select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, select]);

  const error = district.error ?? race.error ?? topo.error;
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

  if (!district.data || !race.data || !topo.data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-void">
        <div className="font-mono text-[13px] tracking-[0.28em] text-ink-2">POLISOF · NJ-07</div>
        <div className="h-px w-40 overflow-hidden bg-white/10">
          <div className="h-full w-1/3 animate-[slide_1.1s_ease-in-out_infinite] bg-white/50" />
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
          loading certified returns
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-void text-ink">
      <Header district={district.data} race={race.data} />

      {/*
        Three columns on a desktop; below that the ranked rail folds away —
        ⌘K and the map both still reach every town — and the dossier stacks
        under the map so the page scrolls down rather than sideways.
      */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <TownRail municipalities={district.data.municipalities} />

        <main className="relative min-h-[62vh] w-full shrink-0 bg-plane lg:min-h-0 lg:w-auto lg:flex-1">
          <MapPane topo={topo.data} municipalities={district.data.municipalities} />
        </main>

        <aside className="flex w-full shrink-0 border-t border-hairline bg-plane lg:w-[412px] lg:border-l lg:border-t-0">
          {selectedMuni ? (
            <TownPanel muni={selectedMuni} district={district.data} />
          ) : (
            <DistrictPanel district={district.data} race={race.data} />
          )}
        </aside>
      </div>

      <CommandPalette municipalities={district.data.municipalities} />
      <Provenance
        manifest={manifest.data}
        district={district.data}
        race={race.data}
        frame={frame.data}
      />
    </div>
  );
}
