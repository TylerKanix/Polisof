/** The district dossier — what is on the ballot, and what the ground looks like. */
import {
  HOUSE_24,
  PRES_16,
  PRES_24,
  SEN_18,
  SEN_24,
  certifiedHouse,
  decisive,
  districtSummary,
  districtTurnout,
  pathToVictory,
  territoryChange,
} from '../lib/analysis';
import { DASH, int, pct, shortDate, signedPct } from '../lib/format';
import { PARTY } from '../lib/palette';
import { shortNames } from '../lib/names';
import { useUI } from '../lib/store';
import type { CountyReturnsFile, DistrictFile, RaceFile } from '../lib/types';
import { Chip, MarginBar, Monogram, ResultRow, SectionTitle, Stat, Unreported } from './primitives';

/** The seat's own elections, reported as they were certified. */
const HOUSE_CYCLES = [
  { id: 'g2024', label: '2024 U.S. House' },
  { id: 'g2018', label: '2018 U.S. House' },
  { id: 'g2016', label: '2016 U.S. House' },
];

const OFFICE_LABEL: Record<string, string> = {
  president: 'President',
  governor: 'Governor',
  ussenate: 'U.S. Senate',
};

/** Ballot order, so two races in one year sort the way a ballot reads. */
const OFFICE_ORDER = ['president', 'governor', 'ussenate'];

/** Hand-written context, where there is something worth saying. */
const BASELINE_NOTES: Record<string, string> = {
  [PRES_24]: 'The baseline underneath',
  [SEN_24]: 'Kim won the state, not this seat',
  [SEN_18]: 'A Democratic midterm',
  [PRES_16]: 'Same towns, eight years back',
  'g2017/governor': 'Murphy won the state by 14 and lost these towns by 11',
  'g2013/governor': 'A Christie landslide, for scale',
};

/**
 * Statewide races, restricted to the district's current 94 towns — coherent
 * precisely because every town voted in the same contest. Derived from
 * whatever the build contains rather than listed, so a cycle added to the
 * datasets appears here without an edit.
 */
function baselinesOf(district: DistrictFile) {
  return Object.keys(district.district)
    .filter((k) => !k.includes('/ushouse'))
    .map((key) => {
      const [election, office] = key.split('/');
      return { key, office, year: Number(election.slice(1)) };
    })
    .filter((b) => OFFICE_LABEL[b.office])
    .sort(
      (a, b) =>
        b.year - a.year || OFFICE_ORDER.indexOf(a.office) - OFFICE_ORDER.indexOf(b.office),
    )
    .map((b) => ({
      key: b.key,
      label: `${b.year} ${OFFICE_LABEL[b.office]}`,
      sub: BASELINE_NOTES[b.key] ?? '',
    }));
}

export default function DistrictPanel({
  district,
  race,
  counties,
}: {
  district: DistrictFile;
  race: RaceFile;
  counties: CountyReturnsFile | null;
}) {
  const r = race.race;
  const { select } = useUI();
  const path = pathToVictory(district, HOUSE_24);
  const turnout = districtTurnout(district.municipalities);
  const top = decisive(district.municipalities, HOUSE_24).slice(0, 8);
  const territory = territoryChange(district.municipalities);
  const shortNameOf = shortNames(district.municipalities);
  const baselines = baselinesOf(district);
  const house24 = districtSummary(district, HOUSE_24);
  const pres24 = districtSummary(district, PRES_24);

  return (
    <div className="flex w-full flex-col lg:h-full lg:overflow-y-auto">
      <div className="border-b border-hairline px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-ink">New Jersey's 7th</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
            {r.cycle}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-ink-2">
          {district.meta.membership.municipalities} municipalities across{' '}
          {district.meta.membership.counties.length} counties —{' '}
          {district.meta.membership.counties.join(', ')}.
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-ink-3">
          Which towns those are is read out of the returns: every New Jersey precinct records the
          congressional district it voted in, and the towns that appear on a NJ-07 ballot are the
          district. {district.meta.membership.split} of them are split with a neighbouring seat.
        </p>
      </div>

      {/* ---- The 2026 race ------------------------------------------------ */}
      <section className="border-b border-hairline px-4 py-3">
        <SectionTitle
          right={
            <a
              href={r.rating.url}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-ink-3 hover:text-ink-2"
            >
              {r.rating.by}: {r.rating.label} ↗
            </a>
          }
        >
          On the ballot — {shortDate(r.electionDay)}
        </SectionTitle>

        <div className="space-y-3">
          {r.candidates.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Monogram name={c.name} party={c.party} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">{c.name}</span>
                  <Chip tone={c.party === 'D' || c.party === 'R' ? c.party : 'neutral'}>
                    {c.status}
                  </Chip>
                </div>
                {c.office ? (
                  <div className="text-[11px] text-ink-2">{c.office}</div>
                ) : null}
                <ul className="mt-1 space-y-0.5">
                  {c.history.map((h) => (
                    <li key={h} className="text-[11px] leading-snug text-ink-3">
                      · {h}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] leading-snug text-ink-2">{c.note}</p>
                <p className="mt-1 text-[10px] leading-snug text-ink-3">{c.nominated}</p>
                <div className="mt-1 flex flex-wrap gap-x-3">
                  {c.sources.map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-dem/80 hover:text-dem hover:underline"
                    >
                      {s.label} ↗
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded border border-hairline bg-white/[0.02] px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.13em] text-ink-3">
            June {new Date(`${r.primary.date}T00:00:00Z`).getUTCDate()} primary
          </div>
          <div className="mt-1.5 space-y-1">
            {r.primary.D.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="w-[104px] shrink-0 truncate text-[11px] text-ink-2">{p.name}</span>
                <div className="relative h-[6px] flex-1 overflow-hidden rounded bg-white/[0.05]">
                  {p.share !== null ? (
                    <div
                      className="absolute inset-y-0 left-0 rounded"
                      style={{ width: `${p.share * 100}%`, background: PARTY.D.base }}
                    />
                  ) : null}
                </div>
                <span className="w-[44px] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-2">
                  {p.share === null ? DASH : `${(p.share * 100).toFixed(1)}%`}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-ink-3">{r.primary.caveat}</p>
        </div>
      </section>

      {/* ---- The seat's own elections ------------------------------------- */}
      <section className="border-b border-hairline px-4 py-3">
        <SectionTitle right={<span className="text-[10px] text-ink-3">as certified</span>}>
          This seat's elections
        </SectionTitle>
        <div className="space-y-3">
          {HOUSE_CYCLES.map(({ id, label }) => {
            const c = certifiedHouse(district, id);
            if (!c) return null;
            return (
              <div key={id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-medium text-ink-2">{label}</span>
                  <span
                    className="font-mono text-[12px] tabular-nums"
                    style={{ color: c.net > 0 ? PARTY.R.bright : PARTY.D.bright }}
                  >
                    {c.net > 0 ? 'R+' : 'D+'}
                    {Math.abs(c.margin).toFixed(1)}
                  </span>
                </div>
                <div className="my-1">
                  <MarginBar margin={c.margin} height={5} />
                </div>
                <ResultRow cands={c.cands} total={c.total} />
                <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[9px] text-ink-3">
                  <span>
                    {c.winner ? `${c.winner.name} won` : ''}
                  </span>
                  <span>
                    {c.linesChanged
                      ? `${c.towns} towns then · ${c.townsStillInDistrict} still in the district`
                      : `${c.towns} towns`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2.5 text-[10px] leading-snug text-ink-3">
          These are the elections themselves, over the towns the district held at the time —
          including the ones since drawn out of it. They match the certified result. The 2021 map
          moved a third of this seat, so the earlier two describe a different electorate from the
          rows below, and there is no honest way to state a past NJ-07 result for today's
          territory: 29 of today's towns were voting in someone else's race.
        </p>
      </section>

      {/* ---- The current lines, in earlier elections ----------------------- */}
      <section className="border-b border-hairline px-4 py-3">
        <SectionTitle right={<span className="text-[10px] text-ink-3">today's 94 towns</span>}>
          Current lines, earlier elections
        </SectionTitle>
        <div className="space-y-3">
          {baselines.map(({ key, label, sub }) => {
            const s = districtSummary(district, key);
            if (!s) return null;
            return (
              <div key={key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-medium text-ink-2">{label}</span>
                  <span
                    className="font-mono text-[12px] tabular-nums"
                    style={{ color: s.net > 0 ? PARTY.R.bright : PARTY.D.bright }}
                  >
                    {s.net > 0 ? 'R+' : 'D+'}
                    {Math.abs(s.margin).toFixed(1)}
                  </span>
                </div>
                <div className="my-1">
                  <MarginBar margin={s.margin} height={5} />
                </div>
                <ResultRow cands={district.district[key].cands} total={s.total} />
                <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[9px] text-ink-3">
                  <span>{sub}</span>
                  <span>
                    {s.municipalities} towns
                    {s.prorated ? ' · split towns prorated' : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2.5 text-[10px] leading-snug text-ink-3">
          Statewide races only, which is what makes this a fair question — every town voted in the
          same contest, so summing today's 94 gives the lean of the seat as drawn. Rows marked{' '}
          <em>prorated</em> include the four towns that straddle a district line; their vote is
          scaled by the share of their House vote cast on a NJ-07 ballot, which is an estimate.
        </p>
      </section>

      {/* ---- The arithmetic ----------------------------------------------- */}
      {path && house24 && pres24 ? (
        <section className="border-b border-hairline px-4 py-3">
          <SectionTitle>What closing it takes</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Net short"
              value={int(path.netShort)}
              hint="Votes the trailing side trailed by in 2024"
            />
            <Stat
              label="Uniform swing"
              value={`${path.swingNeeded.toFixed(2)} pts`}
              hint="Points of swing across the whole district that would have tied it"
            />
            <Stat
              label="Switchers"
              value={int(path.switchers)}
              hint="Voters who would have had to change sides — half the net, since each switch moves two"
            />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-2">
            Kean ran{' '}
            <span
              className="font-mono"
              style={{
                color:
                  house24.margin - pres24.margin > 0 ? PARTY.R.bright : PARTY.D.bright,
              }}
            >
              {signedPct(house24.margin - pres24.margin)} points
            </span>{' '}
            {house24.margin - pres24.margin > 0 ? 'ahead of' : 'behind'} Trump across the same
            towns on the same day. That gap is the incumbent's personal vote, and it is what a
            challenger has to erase on top of the district's lean.
          </p>
          <p className="mt-1.5 text-[10px] leading-snug text-ink-3">
            This is arithmetic on certified totals, not a forecast. It says what happened in 2024
            and what would have reversed it — nothing about November.
          </p>
        </section>
      ) : null}

      {/* ---- Where the votes come from ------------------------------------ */}
      <section className="border-b border-hairline px-4 py-3">
        <SectionTitle right={<span className="text-[10px] text-ink-3">2024 House</span>}>
          Where the margin is made
        </SectionTitle>
        <div className="space-y-1">
          {top.map(({ muni, net }) => (
            <button
              key={muni.geoid}
              onClick={() => select(muni.geoid)}
              className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-white/[0.04]"
            >
              <span className="w-[120px] shrink-0 truncate text-[11px] text-ink-2">
                {shortNameOf.get(muni.geoid) ?? muni.name}
              </span>
              <span className="relative h-[7px] flex-1 overflow-hidden rounded bg-white/[0.05]">
                <span
                  className="absolute inset-y-0 rounded"
                  style={{
                    background: net > 0 ? PARTY.R.base : PARTY.D.base,
                    width: `${Math.min(100, (Math.abs(net) / Math.abs(top[0].net)) * 100)}%`,
                    left: 0,
                  }}
                />
              </span>
              <span
                className="w-[62px] shrink-0 text-right font-mono text-[11px] tabular-nums"
                style={{ color: net > 0 ? PARTY.R.bright : PARTY.D.bright }}
              >
                {net > 0 ? 'R+' : 'D+'}
                {int(Math.abs(net))}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-snug text-ink-3">
          Net votes, not margin: a 40-point town of four thousand people moves fewer votes than a
          six-point town of thirty thousand. These sum, across all{' '}
          {district.meta.membership.municipalities} towns, to the district's 2024 margin — bar the{' '}
          {district.meta.districtUnassigned.votes} overseas and federal ballots the counties file
          without a town.
        </p>
      </section>

      {/* ---- Certified county returns -------------------------------------- */}
      {counties?.returns?.length ? (
        <section className="border-b border-hairline px-4 py-3">
          <SectionTitle right={<span className="text-[10px] text-ink-3">county clerk PDFs</span>}>
            Races with no municipal data
          </SectionTitle>
          <p className="mb-2.5 text-[10px] leading-snug text-ink-3">
            Neither of these races is transcribed by municipality anywhere this build can reach, so
            they cannot be drawn on the map or summed into the district. What does exist is the
            counties' own certified paperwork. Each figure below is one county's result at the
            resolution its Statement of Vote actually provides.
          </p>
          <div className="space-y-3">
            {counties.returns.map((r) => {
              const towns = district.municipalities.filter((m) => m.county === r.county).length;
              const d = r.candidates.find((c) => c.party === 'D');
              const rep = r.candidates.find((c) => c.party === 'R');
              const margin =
                d && rep ? ((rep.total - d.total) / (rep.total + d.total)) * 100 : null;
              return (
                <div key={`${r.county}-${r.election}-${r.office}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-medium text-ink-2">
                      {r.label}
                      <span className="ml-1.5 text-[10px] text-ink-3">{r.county} County</span>
                    </span>
                    <span
                      className="font-mono text-[12px] tabular-nums"
                      style={{
                        color:
                          margin === null
                            ? undefined
                            : margin > 0
                              ? PARTY.R.bright
                              : PARTY.D.bright,
                      }}
                    >
                      {margin === null
                        ? DASH
                        : `${margin > 0 ? 'R+' : 'D+'}${Math.abs(margin).toFixed(1)}`}
                    </span>
                  </div>
                  <div className="my-1">
                    <MarginBar margin={margin} height={5} />
                  </div>
                  <ResultRow
                    cands={r.candidates.map((c) => ({
                      name: c.name,
                      party: c.party,
                      votes: c.total,
                    }))}
                    total={r.contestTotal}
                  />
                  <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[9px] text-ink-3">
                    <span>{r.source.publisher}, certified {r.source.certified}</span>
                    <span>
                      {towns} of {district.meta.membership.municipalities} district towns
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {counties.wanted?.length ? (
            <div className="mt-3 rounded border border-dashed border-hairline p-3">
              <div className="text-[10px] uppercase tracking-[0.13em] text-ink-3">
                What would close these
              </div>
              <div className="mt-1.5 space-y-2">
                {counties.wanted.map((w) => (
                  <div key={w.url}>
                    <div className="text-[11px] leading-snug text-ink-2">{w.what}</div>
                    <div className="text-[10px] leading-snug text-ink-3">{w.unlocks}</div>
                    <div className="mt-0.5 break-all font-mono text-[9px] text-ink-3/70">
                      {w.url}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-snug text-ink-3">
                Every one of those hosts refuses this build's network, so they are named for a
                person to fetch rather than fetched.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ---- The lines moved ---------------------------------------------- */}
      <section className="border-b border-hairline px-4 py-3">
        <SectionTitle>The district is not the district</SectionTitle>
        <p className="text-[11px] leading-snug text-ink-2">
          {territory.added.length} of {district.meta.membership.municipalities} towns now in NJ-07
          voted in a different seat in 2018, before the 2021 map. Historical House rows above
          therefore describe a different electorate from the presidential rows beside them.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {[...territory.groups]
            .sort((a, b) => b[1].length - a[1].length)
            .map(([cd, list]) => (
              <span key={cd} className="text-[10px] text-ink-3">
                <span className="font-mono text-ink-2">
                  {cd === 'unknown' ? 'no race on file' : `NJ-${cd.padStart(2, '0')}`}
                </span>{' '}
                {list.length}
              </span>
            ))}
        </div>
      </section>

      {/* ---- Turnout ------------------------------------------------------- */}
      {turnout ? (
        <section className="border-b border-hairline px-4 py-3">
          <SectionTitle>Turnout, 2024</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Registered" value={int(turnout.registered)} />
            <Stat label="Ballots cast" value={int(turnout.ballots)} />
            <Stat label="Rate" value={pct(turnout.rate)} />
          </div>
          <p className="mt-1.5 text-[10px] text-ink-3">
            All {turnout.towns} municipalities report both figures.
          </p>
        </section>
      ) : null}

      {/* ---- What this build cannot see ------------------------------------ */}
      <section className="px-4 py-3">
        <SectionTitle>Not in this build</SectionTitle>
        <div className="space-y-2">
          {r.liveSources.map((s) => (
            <div key={s.id}>
              <div className="text-[11px] font-medium text-ink-2">{s.label}</div>
              <Unreported action={s.why} href={s.url} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
