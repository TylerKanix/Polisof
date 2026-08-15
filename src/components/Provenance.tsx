/**
 * Where every number came from.
 *
 * This panel exists because the product makes claims an operative will act on.
 * It states which fields are derived from certified records, which are
 * hand-authored and therefore perishable, and which are simply absent until a
 * connector runs — so nobody has to guess how much weight a figure can bear.
 */
import { useUI } from '../lib/store';
import type { Manifest, RacesFile } from '../lib/types';
import { Chip } from './primitives';

export default function Provenance({
  manifest,
  races,
}: {
  manifest: Manifest | null;
  races: RacesFile;
}) {
  const { provenanceOpen, setProvenance } = useUI();
  if (!provenanceOpen) return null;

  const drift = races.meta.rosterDrift ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm"
      onClick={() => setProvenance(false)}
    >
      <div
        className="flex max-h-[84vh] w-[720px] max-w-full flex-col overflow-hidden rounded-lg border border-white/15 bg-plane shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-hairline px-5 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Data provenance</h2>
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
              Built {manifest?.generatedAt?.slice(0, 10) ?? '—'}
            </p>
          </div>
          <button
            onClick={() => setProvenance(false)}
            className="rounded border border-hairline px-2 py-1 text-[10px] text-ink-3 hover:text-ink"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              How to read a figure here
            </h3>
            <div className="space-y-1.5 text-[11.5px] leading-relaxed text-ink-2">
              <p>
                <Chip tone="ghost">Certified</Chip> County results come from state election
                authorities. Margins are two-party.
              </p>
              <p>
                <Chip tone="ghost">Computed</Chip> Ratings, flip targets, coalitions and paths to
                victory are derived in the open from those results plus census estimates. They are
                priors and diagnostics, <em>not</em> forecasts, and the formula is visible in{' '}
                <code className="text-ink">src/lib/analysis.ts</code>.
              </p>
              <p>
                <Chip tone="warn">Perishable</Chip> Challenger fields are hand-authored and
                verified through <strong>{races.meta.verifiedThrough}</strong>. Primaries held after
                that date are not reflected.
              </p>
              <p>
                <Chip tone="warn">Live source</Chip> Polling, market odds, ad buys, appearances and
                cash on hand have no offline copy. They render as an em dash and a link to the
                authoritative source until a connector runs.
              </p>
            </div>
          </section>

          {drift.length > 0 && (
            <section className="rounded border border-amber-500/30 bg-amber-500/[0.07] p-3">
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                Roster drift detected
              </h3>
              <p className="mb-2 text-[11px] leading-snug text-amber-200/85">
                The congressional record disagrees with the hand-authored roster for these seats.
                The record wins; treat the challenger field as stale.
              </p>
              <ul className="space-y-1">
                {drift.map((d) => (
                  <li key={d} className="font-mono text-[10.5px] text-amber-100/90">
                    · {d}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Sources
            </h3>
            <div className="overflow-hidden rounded border border-hairline">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/[0.04] text-[9px] uppercase tracking-wider text-ink-3">
                    <th className="px-3 py-1.5 font-medium">Dataset</th>
                    <th className="px-3 py-1.5 font-medium">Source</th>
                    <th className="px-3 py-1.5 font-medium">Vintage</th>
                    <th className="px-3 py-1.5 font-medium">Licence</th>
                  </tr>
                </thead>
                <tbody>
                  {(manifest?.sources ?? []).map((s) => (
                    <tr key={s.id} className="border-t border-hairline/60 align-top">
                      <td className="px-3 py-1.5 text-[11px] text-ink">{s.label}</td>
                      <td className="px-3 py-1.5 text-[10.5px] text-ink-2">{s.source}</td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-ink-3">{s.vintage}</td>
                      <td className="px-3 py-1.5 text-[10px] text-ink-3">{s.license}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Known limits
            </h3>
            <ul className="space-y-1.5 text-[11px] leading-snug text-ink-2">
              <li>
                · Alaska certifies presidential results by state house district, not borough. Its
                boroughs carry no margin; the statewide total is reconciled from district returns.
              </li>
              <li>
                · Census figures are ACS 5-year and 2018 population estimates.{' '}
                <code className="text-ink">npm run sync:census</code> re-derives them at the current
                vintage from api.census.gov.
              </li>
              <li>
                · Town population is deliberately empty offline. No verifiable place-level source
                was available to the build, and a wrong town population is worse than none.
              </li>
              <li>
                · Portraits exist only for people who have served in Congress. Everyone else renders
                a monogram; campaign photography is copyrighted and is not redistributed here.
              </li>
              <li>
                · {races.meta.candidatesResolvedToRecord} of {races.meta.candidates} candidates
                resolve to a congressional record. The rest carry hand-authored office and
                occupation, which is the part no dataset supplies.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
