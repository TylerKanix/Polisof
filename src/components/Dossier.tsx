/**
 * The race dossier — what opens when you click a whole state.
 *
 * Two kinds of section live here, and they are visually distinct on purpose:
 *   COMPUTED  — flip targets, coalitions, path to victory, baseline. Derived
 *               from certified results and census estimates, with the inputs
 *               shown so the reader can argue with the method.
 *   LIVE      — polling, market odds, ad buys, appearances. These have no
 *               offline source, so instead of a stale copy they carry a
 *               pre-filtered link into the authoritative source, plus the
 *               command that would populate them locally.
 */
import { useMemo } from 'react';
import {
  baselineRating,
  biggestSwings,
  coalitions,
  fmtMargin,
  flipTargets,
  pathToVictory,
  stateMargin,
  Y24,
} from '../lib/analysis';
import { candidateAge, describeOffice, seatContext } from '../lib/candidate';
import { compact, daysUntil, int, money, pct, signedPct } from '../lib/format';
import {
  ballotpediaLink,
  fccPoliticalFileLink,
  fecIndependentLink,
  fecLink,
  googleAdLink,
  kalshiLink,
  metaAdLink,
  pollingLink,
  stateElectionLink,
} from '../lib/links';
import { CATEGORICAL, PARTY, RATING_STYLE, marginColor, partyOf } from '../lib/palette';
import { loadAds, loadMarkets, useAsync } from '../lib/data';
import { useUI } from '../lib/store';
import type { CensusFile, RacesFile, ResultsFile } from '../lib/types';
import { Chip, MarginBar, Portrait, SectionTitle, Stat, StackBar } from './primitives';

export default function Dossier({
  races,
  results,
  census,
  photos,
}: {
  races: RacesFile;
  results: ResultsFile;
  census: CensusFile;
  photos: Set<string>;
}) {
  const { focusState, focus, selectCounty, watchlist, toggleWatch } = useUI();
  const stateRaces = races.races.filter((r) => r.stateFips === focusState);
  // Written by the connectors; absent until a sync has run.
  const markets = useAsync('markets', loadMarkets);
  const ads = useAsync('ads', loadAds);

  const analysis = useMemo(() => {
    if (!focusState) return null;
    return {
      targets: flipTargets(results, focusState, 10),
      swings: biggestSwings(results, focusState, 6),
      blocs: coalitions(results, census.counties, focusState),
    };
  }, [focusState, results, census]);

  if (!focusState || !stateRaces.length || !analysis) return null;
  const primary = stateRaces[0];
  const stateTotals = results.states[focusState];
  const days = daysUntil(races.meta.electionDay);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-hairline bg-plane/80 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              onClick={() => focus(null)}
              className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-ink-3 transition hover:text-ink-2"
            >
              ← National map
            </button>
            <h2 className="truncate text-lg font-semibold tracking-tight text-ink">
              {primary.stateName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Chip>{stateRaces.length > 1 ? `${stateRaces.length} seats up` : `Class ${primary.seatClass}`}</Chip>
              {primary.special && <Chip tone="warn">Special</Chip>}
              {primary.open && <Chip tone="warn">Open seat</Chip>}
              <Chip tone="ghost">{days > 0 ? `${days} days out` : 'Election day passed'}</Chip>
            </div>
          </div>
          <button
            onClick={() => toggleWatch(primary.id)}
            title="Add to watchlist"
            className={`shrink-0 rounded border px-2 py-1 text-[10px] uppercase tracking-wider transition ${
              watchlist.includes(primary.id)
                ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                : 'border-hairline text-ink-3 hover:border-white/25 hover:text-ink-2'
            }`}
          >
            {watchlist.includes(primary.id) ? '★ Watching' : '☆ Watch'}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {stateRaces.map((race) => {
          const baseline = baselineRating({
            state: stateTotals,
            incumbentParty: race.seatHolder.party,
            open: race.open,
            appointed: race.seatHolder.appointed,
          });
          const trailing: 'D' | 'R' = (baseline?.expected ?? 0) > 0 ? 'D' : 'R';
          const path = pathToVictory(results, census.counties, focusState, trailing);

          return (
            <section key={race.id} className="border-b border-hairline/60">
              {stateRaces.length > 1 && (
                <div className="bg-white/[0.03] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-2">
                  {race.special ? 'Special election' : `Class ${race.seatClass} — regular`}
                </div>
              )}

              <div className="space-y-5 px-4 py-4">
                {/* ── Seat context ── */}
                <p className="text-[12px] leading-relaxed text-ink-2">{seatContext(race)}</p>
                {race.note && (
                  <p className="border-l-2 border-white/15 pl-3 text-[11.5px] leading-relaxed text-ink-2/90">
                    {race.note}
                  </p>
                )}
                {race.fieldUnverified && (
                  <p className="rounded border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
                    <strong className="font-semibold">Field unverified. </strong>
                    {race.fieldUnverified}
                  </p>
                )}

                {/* ── Candidates ── */}
                <div>
                  <SectionTitle right={<Chip tone="ghost">Computed + on record</Chip>}>
                    The field
                  </SectionTitle>
                  <div className="space-y-2">
                    {race.candidates.map((c) => {
                      const { age, exact } = candidateAge(c);
                      const office = describeOffice(c);
                      const p = partyOf(c.party);
                      return (
                        <div
                          key={c.id}
                          className="rounded-md border border-hairline bg-white/[0.02] p-2.5"
                        >
                          <div className="flex gap-3">
                            <Portrait
                              name={c.name}
                              party={c.party}
                              bioguide={c.record?.bioguide}
                              available={photos}
                              size={52}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[13.5px] font-semibold text-ink">
                                  {c.name}
                                </span>
                                <span
                                  className="rounded px-1 py-px font-mono text-[9px] font-bold"
                                  style={{ background: `${p.base}26`, color: p.bright }}
                                >
                                  {c.party}
                                </span>
                                {c.status === 'incumbent' && <Chip tone="ghost">Incumbent</Chip>}
                                {c.appointed && <Chip tone="warn">Appointed</Chip>}
                              </div>
                              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5">
                                <Stat
                                  label="Age"
                                  value={age === null ? '—' : `${age}${exact ? '' : ' (est.)'}`}
                                  hint={
                                    exact
                                      ? 'Computed from the birthday on the congressional record'
                                      : 'No birthday on record'
                                  }
                                  missing="No public birth record in the dataset"
                                />
                                <Stat
                                  label="Cash on hand"
                                  value={c.finance?.cashOnHand ? money(c.finance.cashOnHand) : '—'}
                                  accent={p.bright}
                                  hint={
                                    c.finance?.coverageEnd
                                      ? `FEC filing through ${c.finance.coverageEnd}`
                                      : undefined
                                  }
                                  missing="Run npm run sync:fec"
                                />
                              </div>
                              <div className="mt-1.5">
                                <div className="text-[9px] uppercase tracking-[0.12em] text-ink-3">
                                  Office
                                </div>
                                <div className="text-[11px] leading-snug text-ink-2">
                                  {office.primary}
                                </div>
                                {office.secondary && (
                                  <div className="text-[10.5px] leading-snug text-ink-3">
                                    {office.secondary}
                                  </div>
                                )}
                              </div>
                              {c.note && (
                                <p className="mt-1.5 text-[10.5px] leading-snug text-ink-3">
                                  {c.note}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Ext href={fecLink(c, race)}>FEC filings</Ext>
                                <Ext href={metaAdLink(c, race)}>Meta ads</Ext>
                                <Ext href={googleAdLink(c)}>Google ads</Ext>
                                <Ext href={ballotpediaLink(c)}>Profile</Ext>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {!race.candidates.length && (
                      <p className="rounded border border-dashed border-hairline px-3 py-3 text-[11px] text-ink-3">
                        No challenger field verified for this seat. The seat holder shown above is
                        read from the congressional record.
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Baseline ── */}
                {baseline && (
                  <div>
                    <SectionTitle right={<Chip tone="ghost">Computed</Chip>}>
                      Polisof baseline
                    </SectionTitle>
                    <div className="rounded-md border border-hairline bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className="rounded px-2 py-1 font-mono text-[12px] font-semibold uppercase tracking-wider"
                          style={{
                            background: `${RATING_STYLE[baseline.rating]?.fill}2e`,
                            color: RATING_STYLE[baseline.rating]?.fill,
                            border: `1px solid ${RATING_STYLE[baseline.rating]?.fill}66`,
                          }}
                        >
                          {baseline.rating}
                        </span>
                        <span className="font-mono text-[15px] tabular-nums text-ink">
                          {fmtMargin(baseline.expected)}
                        </span>
                      </div>
                      <div className="mt-2.5">
                        <MarginBar margin={baseline.expected} height={7} max={30} />
                      </div>
                      <ul className="mt-2.5 space-y-1">
                        {baseline.explain.map((line) => (
                          <li key={line} className="text-[10.5px] leading-snug text-ink-3">
                            · {line}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 border-t border-hairline pt-2 text-[10px] leading-snug text-ink-3/80">
                        A prior, not a forecast. It says what the seat looks like before anyone
                        campaigns — no polling, no fundraising, no candidate quality.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Live-source sections ── */}
                <div className="grid grid-cols-1 gap-2.5">
                  <LiveSection
                    title="Polling"
                    body="Poll-by-poll results with pollster ratings, sample, mode and sponsor. No connector ships for this: the free aggregation feeds that used to carry it have been retired, and the remaining ones are licensed."
                    href={pollingLink(race)}
                    hrefLabel="Open polling aggregate"
                  />
                  <MarketOdds race={race} data={markets.data?.markets?.[race.state] ?? null} />
                  <AdSpending race={race} data={ads.data?.races?.[race.id] ?? null} />
                  <LiveSection
                    title="Appearances"
                    body="Last public appearance and next scheduled event. No connector ships for this: campaign schedules are published as ad-hoc social posts and press advisories with no common feed, and inventing one would mean scraping sites that forbid it."
                    links={[{ label: 'State election office', href: stateElectionLink(race) }]}
                  />
                </div>

                {/* ── Path to victory ── */}
                <div>
                  <SectionTitle right={<Chip tone="ghost">Computed</Chip>}>
                    Path to victory — {trailing === 'D' ? 'Democrats' : 'Republicans'}
                  </SectionTitle>
                  <div className="rounded-md border border-hairline bg-white/[0.02] p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] text-ink-2">2024 presidential deficit</span>
                      <span className="font-mono text-[14px] tabular-nums text-ink">
                        {int(Math.abs(path.deficit))} votes
                      </span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {path.steps.map((s) => (
                        <div key={s.label} className="flex items-start justify-between gap-3">
                          <span className="text-[10.5px] leading-snug text-ink-3">{s.detail}</span>
                          <span
                            className="shrink-0 font-mono text-[11px] tabular-nums"
                            style={{ color: PARTY[trailing].bright }}
                          >
                            +{compact(s.netVotes)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 border-t border-hairline pt-2 text-[10px] text-ink-3/80">
                      Net votes, not points — the unit a field program is budgeted in.
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {/* ── Flip targets ── */}
        <section className="border-b border-hairline/60 px-4 py-4">
          <SectionTitle right={<Chip tone="ghost">Computed</Chip>}>
            Counties in play
          </SectionTitle>
          <p className="mb-2 text-[10.5px] leading-snug text-ink-3">
            Ranked by persuadable mass — a county's share of the statewide vote multiplied by how
            unresolved its margin is. Closeness alone would surface counties too small to matter;
            size alone would just list the metros.
          </p>
          <div className="space-y-1">
            {analysis.targets.map((t, i) => (
              <button
                key={t.fips}
                onClick={() => selectCounty(t.fips)}
                className="group flex w-full items-center gap-2.5 rounded border border-transparent px-2 py-1.5 text-left transition hover:border-hairline hover:bg-white/[0.03]"
              >
                <span className="w-4 shrink-0 font-mono text-[10px] text-ink-3">{i + 1}</span>
                <span
                  className="h-6 w-1 shrink-0 rounded"
                  style={{ background: marginColor(t.margin24) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] text-ink group-hover:text-white">
                    {t.name}
                  </span>
                  <span className="block truncate text-[9.5px] leading-tight text-ink-3">
                    {t.reason}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[11px] tabular-nums text-ink-2">
                    {fmtMargin(t.margin24)}
                  </span>
                  <span className="block font-mono text-[9px] tabular-nums text-ink-3">
                    {compact(t.votes24)} · {t.shareOfState.toFixed(1)}%
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Swing ── */}
        <section className="border-b border-hairline/60 px-4 py-4">
          <SectionTitle right={<Chip tone="ghost">Computed</Chip>}>
            Biggest movers, 2020 → 2024
          </SectionTitle>
          <div className="space-y-1.5">
            {analysis.swings.map((s) => (
              <button
                key={s.fips}
                onClick={() => selectCounty(s.fips)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition hover:bg-white/[0.03]"
              >
                <span className="min-w-0 flex-1 truncate text-[11px] text-ink-2">{s.name}</span>
                <span className="w-24 shrink-0">
                  <MarginBar margin={s.swing} height={5} max={20} />
                </span>
                <span
                  className="w-14 shrink-0 text-right font-mono text-[10.5px] tabular-nums"
                  style={{ color: (s.swing ?? 0) > 0 ? PARTY.R.bright : PARTY.D.bright }}
                >
                  {signedPct(s.swing)}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Coalitions ── */}
        <section className="px-4 py-4">
          <SectionTitle right={<Chip tone="ghost">Computed</Chip>}>
            Coalitions in this electorate
          </SectionTitle>
          <p className="mb-3 text-[10.5px] leading-snug text-ink-3">
            Every county falls in exactly one settlement type and any number of demographic
            overlays. Share is of votes actually cast in 2024, so a bloc's weight is its turnout,
            not its population.
          </p>

          <BlocTable title="By settlement type" blocs={analysis.blocs.place} />
          <div className="h-4" />
          <BlocTable title="By demographic concentration" blocs={analysis.blocs.overlay} overlay />

          {stateTotals && (
            <div className="mt-4 rounded-md border border-hairline bg-white/[0.02] p-3">
              <SectionTitle>Statewide, 2024</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Votes cast" value={compact(stateTotals.t[Y24])} />
                <Stat label="Margin" value={fmtMargin(stateMargin(stateTotals, Y24))} />
                <Stat label="Counties" value={int(stateTotals.counties)} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function BlocTable({
  title,
  blocs,
  overlay = false,
}: {
  title: string;
  blocs: { id: string; label: string; description: string; shareOfState: number; margin24: number | null; swing: number | null; votes: number; counties: number }[];
  overlay?: boolean;
}) {
  if (!blocs.length) return null;
  const composition = blocs.slice(0, 7).map((b, i) => ({
    label: b.label,
    value: b.shareOfState,
    color: CATEGORICAL[i % CATEGORICAL.length],
  }));

  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {title}
      </div>
      {!overlay && (
        <div className="mb-2">
          <StackBar segments={composition} height={7} />
        </div>
      )}
      <div className="space-y-1">
        {blocs.map((b, i) => (
          <div
            key={b.id}
            className="grid grid-cols-[10px_1fr_auto] items-center gap-2 rounded px-1 py-1"
            title={b.description}
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: overlay ? marginColor(b.margin24) : CATEGORICAL[i % CATEGORICAL.length] }}
            />
            <div className="min-w-0">
              <div className="truncate text-[11px] text-ink-2">{b.label}</div>
              <div className="truncate text-[9px] leading-tight text-ink-3">
                {b.counties} {b.counties === 1 ? 'county' : 'counties'} · {compact(b.votes)} votes ·{' '}
                {b.description}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[11px] tabular-nums text-ink">
                {pct(b.shareOfState, 1)}
              </div>
              <div className="font-mono text-[9.5px] tabular-nums text-ink-3">
                {fmtMargin(b.margin24)}
                {b.swing !== null && (
                  <span style={{ color: b.swing > 0 ? PARTY.R.base : PARTY.D.base }}>
                    {' '}
                    {signedPct(b.swing, 0)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A section whose data is live-only: shows the doorway, never a stale copy. */
function LiveSection({
  title,
  command,
  body,
  href,
  hrefLabel,
  links,
}: {
  title: string;
  command?: string;
  body: string;
  href?: string;
  hrefLabel?: string;
  links?: { label: string; href: string }[];
}) {
  return (
    <div className="rounded-md border border-dashed border-hairline bg-white/[0.015] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-2">
          {title}
        </span>
        <Chip tone="warn">Live source</Chip>
      </div>
      <p className="mt-1.5 text-[10.5px] leading-snug text-ink-3">{body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {href && hrefLabel && <Ext href={href}>{hrefLabel}</Ext>}
        {links?.map((l) => (
          <Ext key={l.href} href={l.href}>
            {l.label}
          </Ext>
        ))}
        {command && (
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-3">
            {command}
          </code>
        )}
      </div>
    </div>
  );
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="rounded border border-hairline px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider text-ink-3 transition hover:border-white/30 hover:text-ink"
    >
      {children} ↗
    </a>
  );
}


/** Kalshi prices, shown beside the baseline rather than folded into it. */
function MarketOdds({
  race,
  data,
}: {
  race: Parameters<typeof seatContext>[0];
  data: { title: string; url: string; markets: { ticker: string; subtitle: string | null; lastPrice: number | null; yesBid: number | null; yesAsk: number | null; volume: number | null }[] } | null;
}) {
  if (!data || !data.markets.length) {
    return (
      <LiveSection
        title="Market odds"
        command="npm run sync:kalshi"
        body="Kalshi last trade, bid/ask and volume for this seat. The connector is keyless — Kalshi's market-data endpoints are public."
        href={kalshiLink(race)}
        hrefLabel="Open Kalshi market"
      />
    );
  }
  return (
    <div className="rounded-md border border-hairline bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-2">
          Market odds
        </span>
        <Chip tone="ghost">Kalshi</Chip>
      </div>
      <div className="mt-2 space-y-1">
        {data.markets.slice(0, 6).map((m) => (
          <div key={m.ticker} className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-[11px] text-ink-2">
              {m.subtitle ?? m.ticker}
            </span>
            <span className="w-20 shrink-0">
              <MarginBar margin={m.lastPrice === null ? null : (50 - m.lastPrice) * 0.8} height={5} max={40} />
            </span>
            <span className="w-12 shrink-0 text-right font-mono text-[12px] tabular-nums text-ink">
              {m.lastPrice === null ? '—' : `${m.lastPrice}¢`}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-hairline pt-2 text-[9.5px] leading-snug text-ink-3">
        Cents equal implied probability. Deliberately not blended into the baseline — a market
        and an arithmetic prior are different claims.
      </p>
      <div className="mt-1.5">
        <Ext href={data.url}>Open market</Ext>
      </div>
    </div>
  );
}

/** Itemised outside spending from FEC Schedule E. */
function AdSpending({
  race,
  data,
}: {
  race: Parameters<typeof seatContext>[0];
  data: { outsideSpending: { spender: string | null; amount: number | null; supportOppose: string | null; candidate: string | null; date: string | null }[]; totals: { outside: number } } | null;
}) {
  if (!data || !data.outsideSpending.length) {
    return (
      <LiveSection
        title="Advertising with money behind it"
        command="npm run sync:ads"
        body="Itemised independent expenditures from FEC Schedule E, plus creative-level Meta ads when a token is supplied. Broadcast buys live in the FCC political file, which is per-station and not bulk-queryable."
        links={[
          { label: 'FCC political file', href: fccPoliticalFileLink(race) },
          { label: 'Outside spending (FEC)', href: fecIndependentLink(race) },
        ]}
      />
    );
  }
  const bySpender = new Map<string, number>();
  for (const e of data.outsideSpending) {
    if (!e.spender || !e.amount) continue;
    bySpender.set(e.spender, (bySpender.get(e.spender) ?? 0) + e.amount);
  }
  const top = [...bySpender.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="rounded-md border border-hairline bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-2">
          Outside spending
        </span>
        <span className="font-mono text-[13px] tabular-nums text-ink">
          {money(data.totals.outside)}
        </span>
      </div>
      <div className="mt-2 space-y-1">
        {top.map(([spender, amount]) => (
          <div key={spender} className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-2" title={spender}>
              {spender}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-3">
              {money(amount)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-hairline pt-2">
        <Ext href={fecIndependentLink(race)}>All expenditures</Ext>
        <Ext href={fccPoliticalFileLink(race)}>FCC political file</Ext>
      </div>
    </div>
  );
}
