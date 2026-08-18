/** One municipality, in full. */
import {
  HOUSE_16,
  HOUSE_18,
  HOUSE_24,
  PRES_16,
  PRES_24,
  SEN_18,
  SEN_24,
  marginOf,
  netContribution,
  overperformance,
  rankOf,
  swing,
  turnoutRate,
  twoParty,
} from '../lib/analysis';
import { DASH, int, pct, signedPct } from '../lib/format';
import { METRIC_BY_ID, METRICS } from '../lib/metrics';
import { PARTY } from '../lib/palette';
import { useUI } from '../lib/store';
import type { DistrictFile, Municipality } from '../lib/types';
import { Chip, MarginBar, ResultRow, SectionTitle, Stat } from './primitives';

const RACES = [
  { key: HOUSE_24, label: '2024 U.S. House' },
  { key: PRES_24, label: '2024 President' },
  { key: SEN_24, label: '2024 U.S. Senate' },
  { key: HOUSE_18, label: '2018 U.S. House' },
  { key: SEN_18, label: '2018 U.S. Senate' },
  { key: PRES_16, label: '2016 President' },
  { key: HOUSE_16, label: '2016 U.S. House' },
];

const MODE_LABEL: Record<string, string> = {
  machine: 'Election day',
  mail: 'Vote by mail',
  early: 'Early voting',
  provisional: 'Provisional',
  overseas: 'Overseas / federal',
};

export default function TownPanel({
  muni,
  district,
}: {
  muni: Municipality;
  district: DistrictFile;
}) {
  const { select, metric: metricId } = useUI();
  const metric = METRIC_BY_ID.get(metricId) ?? METRICS[0];
  const rank = rankOf(district.municipalities, muni, metric.value);
  const density = muni.pop2010 && muni.sqMiles ? muni.pop2010 / muni.sqMiles : null;
  const split = overperformance(muni, HOUSE_24, PRES_24);
  const movement = swing(muni, PRES_16, PRES_24);
  const net = netContribution(muni, HOUSE_24);
  const filing = district.meta.voteModeFiling[muni.county];
  const modes = muni.results[PRES_24]?.byMode ?? {};

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-hairline bg-plane px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-ink">{muni.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink-3">{muni.county} County</span>
              {muni.inDistrict === 'split' ? (
                <Chip tone="warn" title="Partly in another congressional district">
                  split town
                </Chip>
              ) : null}
            </div>
          </div>
          <button
            onClick={() => select(null)}
            className="shrink-0 rounded border border-hairline px-2 py-1 text-[11px] text-ink-3 hover:text-ink"
          >
            Close
          </button>
        </div>
      </div>

      {muni.inDistrict === 'split' ? (
        <div className="border-b border-hairline bg-amber-500/[0.05] px-4 py-2.5">
          <p className="text-[11px] leading-snug text-ink-2">
            {(muni.districtShare * 100).toFixed(1)}% of this town's 2024 House vote was cast on a
            NJ-07 ballot. The rest went to{' '}
            {muni.otherDistricts
              .map((o) => `NJ-${String(o.cd).padStart(2, '0')} (${(o.share * 100).toFixed(1)}%)`)
              .join(', ')}
            . Its presidential and Senate figures below are for the <em>whole</em> town — no
            precinct-level split of those races is published, so they are not the district's alone.
          </p>
        </div>
      ) : null}

      <section className="border-b border-hairline px-4 py-3">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Ballots 2024" value={int(muni.turnout.g2024?.ballots ?? null)} />
          <Stat label="Turnout" value={pct(turnoutRate(muni))} />
          <Stat
            label="Net to margin"
            value={net === null ? DASH : `${net > 0 ? 'R+' : 'D+'}${int(Math.abs(net))}`}
            accent={net === null ? undefined : net > 0 ? PARTY.R.bright : PARTY.D.bright}
            hint="This town's contribution to the district's 2024 House margin"
          />
          <Stat
            label="Registered"
            value={int(muni.turnout.g2024?.registered ?? null)}
          />
          <Stat label="Area" value={muni.sqMiles === null ? DASH : `${muni.sqMiles} sq mi`} />
          <Stat
            label="Density"
            value={density === null ? DASH : `${int(density)}/sq mi`}
            hint="Census 2010 — the only population figure available offline"
          />
        </div>
        {rank ? (
          <p className="mt-2 text-[10px] text-ink-3">
            Ranks <span className="font-mono text-ink-2">{rank.rank}</span> of {rank.of} on the
            current layer — {metric.label.toLowerCase()}.
          </p>
        ) : null}
      </section>

      <section className="border-b border-hairline px-4 py-3">
        <SectionTitle>Movement</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Swing 2016 → 2024"
            value={movement === null ? DASH : `${signedPct(movement)} pts`}
            accent={
              movement === null ? undefined : movement > 0 ? PARTY.R.bright : PARTY.D.bright
            }
            hint="Presidential margin change; positive is toward the Republicans"
          />
          <Stat
            label="Kean v Trump"
            value={split === null ? DASH : `${signedPct(split)} pts`}
            accent={split === null ? undefined : split > 0 ? PARTY.R.bright : PARTY.D.bright}
            hint="Kean's 2024 margin here, minus Trump's in the same town"
          />
        </div>
      </section>

      <section className="border-b border-hairline px-4 py-3">
        <SectionTitle>Certified results</SectionTitle>
        <div className="space-y-3.5">
          {RACES.map(({ key, label }) => {
            const res = muni.results[key];
            if (!res) return null;
            const tp = twoParty(res);
            const m = marginOf(muni, key);
            const wrongDistrict = key.endsWith('/ushouse') && res.cd !== null && res.cd !== 7;
            return (
              <div key={key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-medium text-ink-2">
                    {label}
                    {wrongDistrict ? (
                      <span className="ml-1.5 font-mono text-[10px] text-amber-400/90">
                        NJ-{String(res.cd).padStart(2, '0')}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="font-mono text-[12px] tabular-nums"
                    style={{
                      color: m === null ? undefined : m > 0 ? PARTY.R.bright : PARTY.D.bright,
                    }}
                  >
                    {m === null ? DASH : `${m > 0 ? 'R+' : 'D+'}${Math.abs(m).toFixed(1)}`}
                  </span>
                </div>
                <div className="my-1">
                  <MarginBar margin={m} height={5} />
                </div>
                <ResultRow cands={res.cands} total={res.total} />
                {tp && res.total > tp.d + tp.r ? (
                  <div className="mt-0.5 text-[9px] text-ink-3">
                    {int(res.total - tp.d - tp.r)} votes to other candidates and write-ins
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {Object.entries(muni.results).filter(([k]) => k.includes('/ushouse@')).length ? (
          <div className="mt-3.5 border-t border-hairline pt-3">
            <div className="mb-1.5 text-[10px] uppercase tracking-[0.13em] text-ink-3">
              The other ballot
            </div>
            {Object.entries(muni.results)
              .filter(([k]) => k.includes('/ushouse@'))
              .map(([k, res]) => (
                <div key={k} className="mb-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-medium text-ink-2">
                      {k.slice(1, 5)} U.S. House
                      <span className="ml-1.5 font-mono text-[10px] text-amber-400/90">
                        NJ-{String(res.cd).padStart(2, '0')}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-ink-3">
                      {int(res.total)} ballots
                    </span>
                  </div>
                  <div className="mt-1">
                    <ResultRow cands={res.cands} total={res.total} />
                  </div>
                </div>
              ))}
            <p className="text-[10px] leading-snug text-ink-3">
              Precincts of this town that sit outside NJ-07 voted in this race instead. It is a
              different contest with different candidates, so it is counted separately and never
              pooled with the NJ-07 result above.
            </p>
          </div>
        ) : null}

        {muni.results[HOUSE_18]?.cd !== undefined && muni.results[HOUSE_18]?.cd !== 7 ? (
          <p className="mt-2.5 text-[10px] leading-snug text-ink-3">
            This town was not in NJ-07 before the 2021 map, so its earlier House rows are a
            different seat's race. Its presidential rows are unaffected — a presidential ballot
            does not know about district lines.
          </p>
        ) : null}
      </section>

      <section className="px-4 py-3">
        <SectionTitle>How the ballots were filed</SectionTitle>
        {Object.keys(modes).length > 1 ? (
          <div className="space-y-1">
            {Object.entries(modes)
              .sort((a, b) => b[1] - a[1])
              .map(([mode, votes]) => {
                const total = Object.values(modes).reduce((a, b) => a + b, 0);
                return (
                  <div key={mode} className="flex items-center gap-2">
                    <span className="w-[104px] shrink-0 text-[11px] text-ink-2">
                      {MODE_LABEL[mode] ?? mode}
                    </span>
                    <span className="relative h-[6px] flex-1 overflow-hidden rounded bg-white/[0.05]">
                      <span
                        className="absolute inset-y-0 left-0 rounded bg-ink-3"
                        style={{ width: `${(votes / total) * 100}%` }}
                      />
                    </span>
                    <span className="w-[44px] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-2">
                      {((votes / total) * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-[11px] leading-snug text-ink-3">
            {muni.county} County does not file mail, early or provisional ballots as separate
            rows — every ballot arrives inside the district totals. Nothing here is missing; the
            breakdown simply does not exist in the certification.
          </p>
        )}
        {filing?.separates?.length ? (
          <p className="mt-2 text-[10px] leading-snug text-ink-3">
            Labels are the county's own. {muni.county} files{' '}
            {filing.separates.map((s) => MODE_LABEL[s]?.toLowerCase() ?? s).join(' and ')}{' '}
            separately; the shares are not comparable with a county that files them differently.
          </p>
        ) : null}
      </section>
    </div>
  );
}
