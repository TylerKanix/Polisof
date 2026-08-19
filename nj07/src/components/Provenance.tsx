/** Where every number came from, and what is knowingly missing. */
import { useUI } from '../lib/store';
import type { DistrictFile, Frame, Manifest, RaceFile } from '../lib/types';
import { SectionTitle } from './primitives';

export default function Provenance({
  manifest,
  district,
  race,
  frame,
}: {
  manifest: Manifest | null;
  district: DistrictFile;
  race: RaceFile;
  frame: Frame | null;
}) {
  const { provenanceOpen, setProvenance } = useUI();
  if (!provenanceOpen) return null;
  const meta = district.meta;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={() => setProvenance(false)}
    >
      <div
        className="max-h-[86vh] w-[760px] max-w-full overflow-y-auto rounded-lg border border-hairline bg-surface shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-hairline bg-surface px-5 py-3">
          <h2 className="text-[14px] font-semibold text-ink">Sources and limits</h2>
          <button
            onClick={() => setProvenance(false)}
            className="rounded border border-hairline px-2 py-1 text-[11px] text-ink-3 hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <section>
            <SectionTitle>What kind of number is on screen</SectionTitle>
            <table className="w-full text-[11px]">
              <tbody className="align-top">
                {[
                  ['Certified', 'Transcribed from a county clerk certification, unmodified', 'Every margin, vote count and turnout figure'],
                  ['Derived', 'Computed in the open from certified totals', 'Swing, ticket-splitting, net contribution, district membership'],
                  ['Estimated', 'Certified totals scaled by a measured share', 'Split towns inside district-wide presidential and Senate rows'],
                  ['Hand-authored', 'Typed from public reporting, with a citation', 'The 2026 candidate roster only'],
                  ['No source', 'Renders as an em dash and a link', 'Fundraising, ad buys, polling'],
                ].map(([k, what, where]) => (
                  <tr key={k} className="border-b border-hairline/60">
                    <td className="py-1.5 pr-3 font-medium text-ink">{k}</td>
                    <td className="py-1.5 pr-3 text-ink-2">{what}</td>
                    <td className="py-1.5 text-ink-3">{where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <SectionTitle>Datasets</SectionTitle>
            <div className="space-y-2.5">
              {(manifest?.sources ?? []).map((s) => (
                <div key={s.id} className="rounded border border-hairline bg-white/[0.02] p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px] font-medium text-ink">{s.label}</span>
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-[10px] text-dem hover:underline"
                      >
                        source ↗
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-2">{s.source}</div>
                  <div className="mt-0.5 text-[10px] text-ink-3">
                    {s.vintage} · {s.license}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle>How the district was defined</SectionTitle>
            <p className="text-[11px] leading-relaxed text-ink-2">{meta.membership.method}</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
              {meta.membership.municipalities} municipalities, {meta.membership.whole} wholly inside
              and {meta.membership.split} split with a neighbouring district. The build fails rather
              than ships if a row carrying NJ-07 House votes cannot be matched to a municipality, so
              the district cannot quietly come out short.
            </p>
          </section>

          <section>
            <SectionTitle>Votes that belong to no town</SectionTitle>
            <p className="text-[11px] leading-relaxed text-ink-3">
              {meta.districtUnassigned.votes.toLocaleString('en-US')} NJ-07 ballots are filed by the
              counties at county level — overseas and federal voters, who are attached to no
              municipality by construction ({meta.districtUnassigned.places.join('; ')}). Every
              district total here is the sum of its municipalities, so these are excluded, which is
              why the topline sits a hair under the statewide certification. They are counted here
              rather than folded into a town that did not cast them.
            </p>
          </section>

          {meta.sourceAnomalies?.length ? (
            <section>
              <SectionTitle>Where the certification does not add up</SectionTitle>
              <p className="mb-2 text-[11px] leading-relaxed text-ink-3">
                A town cannot cast more votes in a race than it cast ballots. These do. The
                discrepancy is in the source rather than in this build, so it is published rather
                than rounded away — Union County's Winfield rows are scrambled, with the vote
                totals filed under labels reading "Overseas Ballots" while the district rows hold
                almost nothing.
              </p>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-hairline text-[10px] uppercase tracking-wider text-ink-3">
                    <th className="py-1 text-left font-medium">Municipality</th>
                    <th className="py-1 text-left font-medium">Race</th>
                    <th className="py-1 text-right font-medium">Votes</th>
                    <th className="py-1 text-right font-medium">Ballots</th>
                    <th className="py-1 text-right font-medium">Excess</th>
                  </tr>
                </thead>
                <tbody>
                  {meta.sourceAnomalies.map((a, i) => (
                    <tr key={i} className="border-b border-hairline/60">
                      <td className="py-1.5 text-ink-2">{a.municipality}</td>
                      <td className="py-1.5 font-mono text-[10px] text-ink-3">{a.race}</td>
                      <td className="py-1.5 text-right font-mono text-ink-3">
                        {a.votes.toLocaleString('en-US')}
                      </td>
                      <td className="py-1.5 text-right font-mono text-ink-3">
                        {a.ballots.toLocaleString('en-US')}
                      </td>
                      <td className="py-1.5 text-right font-mono text-amber-400/90">+{a.excess}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <section>
            <SectionTitle>Rows that are not candidates</SectionTitle>
            <p className="text-[11px] leading-relaxed text-ink-3">
              Some counties file ballot accounting on the same rows as people. Counted as a
              candidate, an <em>Under Votes</em> line inflates the denominator and quietly deflates
              every real candidate's share, so these are dropped before they reach a total —
              {meta.droppedRows?.length
                ? ` ${meta.droppedRows.reduce((a, r) => a + r.votes, 0).toLocaleString('en-US')} of them, from ${meta.droppedRows.map((r) => r.row).join('; ')}.`
                : ' none appeared in this build.'}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
              Four counties also print the whole ticket — <em>Kamala D. Harris and Tim Walz</em> —
              where the rest print only the head of it. The running mate is dropped so a
              presidential row counts the same person in every county; left alone it split one
              candidate's vote in two.
            </p>
          </section>

          <section>
            <SectionTitle>Known gaps</SectionTitle>
            <div className="space-y-2">
              {meta.gaps.map((g) => (
                <div key={g.id} className="rounded border border-dashed border-hairline p-3">
                  <div className="text-[12px] font-medium text-ink-2">{g.what}</div>
                  <p className="mt-1 text-[11px] leading-snug text-ink-3">{g.why}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle>How each county files its ballots</SectionTitle>
            <p className="mb-2 text-[11px] leading-snug text-ink-3">
              This is why there is no vote-by-mail layer on the map. Four of these six counties fold
              every ballot into the district rows, so a mail-share choropleth would draw a cliff at
              the county line and read as a fact about voters.
            </p>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-hairline text-[10px] uppercase tracking-wider text-ink-3">
                  <th className="py-1 text-left font-medium">County</th>
                  <th className="py-1 text-left font-medium">Filed separately</th>
                  <th className="py-1 text-right font-medium">Shares</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(meta.voteModeFiling).map(([county, f]) => (
                  <tr key={county} className="border-b border-hairline/60">
                    <td className="py-1.5 text-ink-2">{county}</td>
                    <td className="py-1.5 text-ink-3">
                      {f.separates.length ? f.separates.join(', ') : 'nothing — all in district rows'}
                    </td>
                    <td className="py-1.5 text-right font-mono text-ink-3">
                      {Object.entries(f.shares)
                        .map(([k, v]) => `${k.slice(0, 4)} ${(v * 100).toFixed(0)}%`)
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <SectionTitle>Corrections applied to the sources</SectionTitle>
            <p className="mb-2 text-[11px] leading-snug text-ink-3">
              County clerks misspell their own towns, and one 2018 file substitutes F for L
              throughout. A spelling is only corrected when the town it would name is otherwise
              absent from that office's section of that file and exactly one town is one edit away —
              otherwise the row is left unresolved and counted as such. Every correction that fired:
            </p>
            <div className="max-h-52 overflow-y-auto rounded border border-hairline">
              <table className="w-full text-[10px]">
                <tbody>
                  {meta.spellingCorrections.map((c, i) => (
                    <tr key={i} className="border-b border-hairline/60">
                      <td className="py-1 pl-2 pr-2 font-mono text-ink-3">{c.election}</td>
                      <td className="py-1 pr-2 text-ink-3">{c.county}</td>
                      <td className="py-1 pr-2 font-mono text-ink-2">{c.wrote}</td>
                      <td className="py-1 pr-2 text-ink-3">→</td>
                      <td className="py-1 pr-2 text-ink">{c.read}</td>
                      <td className="py-1 pr-2 text-right text-ink-3">{c.how}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink-3">
              Union County files provisional and overseas ballots under two-letter codes. The codes
              are solved by constraint rather than assumed:{' '}
              {meta.abbreviationCodes
                .filter((c) => c.county === 'union')
                .map((c) => `${c.resolved} resolved, ${c.unresolved.length} contested`)
                .join('') || 'not present in this build'}
              .
            </p>
          </section>

          <section>
            <SectionTitle>Geometry</SectionTitle>
            {frame ? (
              <p className="text-[11px] leading-relaxed text-ink-3">
                Municipal polygons are simplified through a shared topology, so neighbouring towns
                keep the same border rather than opening hairline gaps.{' '}
                {frame.simplification.verticesBefore.toLocaleString('en-US')} vertices reduced to{' '}
                {frame.simplification.verticesAfter.toLocaleString('en-US')}; total district area
                preserved to {(100 * (1 - Math.abs(frame.simplification.areaLoss))).toFixed(3)}%. The
                build refuses any simplification that moves a single town's area by more than 2%.
              </p>
            ) : null}
          </section>

          <section>
            <SectionTitle>The roster is perishable</SectionTitle>
            <p className="text-[11px] leading-relaxed text-ink-2">{race.meta.warning}</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
              Verified through {race.meta.verifiedThrough}. Anything that happened after that —
              a withdrawal, a by-petition candidate qualifying, a change in the incumbent's status —
              is not reflected here and will not announce itself. Datasets generated{' '}
              {meta.generatedAt}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
