/** The district dossier — what is on the ballot, and what the ground looks like. */
import {
  HOUSE_16,
  HOUSE_18,
  HOUSE_24,
  PRES_16,
  PRES_24,
  SEN_18,
  SEN_24,
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
import type { DistrictFile, RaceFile } from '../lib/types';
import { Chip, MarginBar, Monogram, ResultRow, SectionTitle, Stat, Unreported } from './primitives';

const BASELINES = [
  { key: HOUSE_24, label: '2024 U.S. House', sub: 'These lines, last time out' },
  { key: PRES_24, label: '2024 President', sub: 'The baseline underneath' },
  { key: SEN_24, label: '2024 U.S. Senate', sub: 'Kim won the state, not this seat' },
  { key: PRES_16, label: '2016 President', sub: 'Same towns, eight years back' },
  { key: SEN_18, label: '2018 U.S. Senate', sub: 'A Democratic midterm' },
  { key: HOUSE_18, label: '2018 U.S. House', sub: 'Old lines — see below' },
  { key: HOUSE_16, label: '2016 U.S. House', sub: 'Old lines — see below' },
];

export default function DistrictPanel({
  district,
  race,
}: {
  district: DistrictFile;
  race: RaceFile;
}) {
  const r = race.race;
  const { select } = useUI();
  const path = pathToVictory(district, HOUSE_24);
  const turnout = districtTurnout(district.municipalities);
  const top = decisive(district.municipalities, HOUSE_24).slice(0, 8);
  const territory = territoryChange(district.municipalities);
  const shortNameOf = shortNames(district.municipalities);
  const house24 = districtSummary(district, HOUSE_24);
  const pres24 = districtSummary(district, PRES_24);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
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

      {/* ---- What the district has actually done -------------------------- */}
      <section className="border-b border-hairline px-4 py-3">
        <SectionTitle>Certified baselines</SectionTitle>
        <div className="space-y-3">
          {BASELINES.map(({ key, label, sub }) => {
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
          Rows marked <em>prorated</em> include the four towns that straddle a district line; their
          presidential vote is scaled by the share of their House vote cast on a NJ-07 ballot. That
          is an estimate. House rows need no scaling — a NJ-07 ballot is a NJ-07 ballot.
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
          six-point town of thirty thousand. These figures sum, across all{' '}
          {district.meta.membership.municipalities} towns, to the district's 2024 margin.
        </p>
      </section>

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
