/**
 * County and town intelligence.
 *
 * Opens when a county is clicked inside a zoomed state. Everything shown is a
 * published estimate with a stated vintage — nothing is modelled, and every
 * null renders as an em dash rather than a zero.
 */
import { useEffect, useMemo, useState } from 'react';
import { Y16, Y20, Y24, countyMargin, classifyCounty, fmtMargin, swing } from '../lib/analysis';
import { compact, int, money, pct, signedPct } from '../lib/format';
import { censusCountyLink } from '../lib/links';
import { CATEGORICAL, PARTY, marginColor } from '../lib/palette';
import { loadPlaces } from '../lib/data';
import { useUI } from '../lib/store';
import type { CensusFile, PlacesFile, ResultsFile } from '../lib/types';
import { Chip, MarginBar, SectionTitle, Stat, StackBar } from './primitives';

const BLOC_LABEL: Record<string, string> = {
  'urban-core': 'Urban core',
  'dense-suburb': 'Educated suburb',
  'working-suburb': 'Working suburb',
  exurb: 'Growing exurb',
  'small-city': 'Small city & town',
  'rural-degree': 'Rural, higher-education',
  rural: 'Rural, non-college',
};

export default function CountyPanel({
  results,
  census,
}: {
  results: ResultsFile;
  census: CensusFile;
}) {
  const { selectedCounty, selectCounty, focusState, selectedPlace, selectPlace } = useUI();
  const [places, setPlaces] = useState<PlacesFile | null>(null);

  useEffect(() => {
    if (!focusState) return;
    let live = true;
    loadPlaces(focusState)
      .then((p) => live && setPlaces(p))
      .then(undefined, () => undefined);
    return () => {
      live = false;
    };
  }, [focusState]);

  const county = selectedCounty ? results.counties[selectedCounty] : null;
  const c = selectedCounty ? census.counties[selectedCounty] : null;

  const townsHere = useMemo(
    () =>
      places?.places
        .filter((p) => p.c === selectedCounty)
        .sort((a, b) => (b.p ?? 0) - (a.p ?? 0) || a.n.localeCompare(b.n)) ?? [],
    [places, selectedCounty],
  );

  if (!selectedCounty) return null;

  const m24 = county ? countyMargin(county, Y24) : null;
  const m20 = county ? countyMargin(county, Y20) : null;
  const m16 = county ? countyMargin(county, Y16) : null;
  const sw = county ? swing(county) : null;
  const bloc = classifyCounty(c ?? undefined);
  const turnoutChange =
    county?.t[Y20] && county?.t[Y24]
      ? ((county.t[Y24]! - county.t[Y20]!) / county.t[Y20]!) * 100
      : null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-plane">
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-3">County profile</div>
          <h3 className="truncate text-[15px] font-semibold text-ink">
            {county?.n ?? selectedCounty}
          </h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip tone="ghost">FIPS {selectedCounty}</Chip>
            {bloc && <Chip>{BLOC_LABEL[bloc]}</Chip>}
          </div>
        </div>
        <button
          onClick={() => selectCounty(null)}
          className="shrink-0 rounded border border-hairline px-1.5 py-0.5 text-[10px] text-ink-3 transition hover:text-ink"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {/* ── Vote history ── */}
        <div>
          <SectionTitle right={<Chip tone="ghost">Certified</Chip>}>
            Presidential result
          </SectionTitle>
          {county ? (
            <div className="space-y-2">
              {[
                { y: 2024, m: m24, t: county.t[Y24] },
                { y: 2020, m: m20, t: county.t[Y20] },
                { y: 2016, m: m16, t: county.t[Y16] },
              ].map((row) => (
                <div key={row.y} className="flex items-center gap-2.5">
                  <span className="w-8 shrink-0 font-mono text-[10px] text-ink-3">{row.y}</span>
                  <span className="flex-1">
                    <MarginBar margin={row.m} height={6} />
                  </span>
                  <span
                    className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums"
                    style={{ color: (row.m ?? 0) > 0 ? PARTY.R.bright : PARTY.D.bright }}
                  >
                    {fmtMargin(row.m)}
                  </span>
                  <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-ink-3">
                    {compact(row.t)}
                  </span>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-2">
                <Stat
                  label="Swing 20→24"
                  value={sw === null ? '—' : `${sw > 0 ? 'R' : 'D'}+${Math.abs(sw).toFixed(1)}`}
                  accent={(sw ?? 0) > 0 ? PARTY.R.bright : PARTY.D.bright}
                />
                <Stat label="Turnout change" value={turnoutChange === null ? '—' : `${signedPct(turnoutChange)}%`} />
              </div>
            </div>
          ) : (
            <p className="rounded border border-dashed border-hairline px-3 py-2 text-[10.5px] leading-snug text-ink-3">
              No county-level presidential result. Alaska certifies by state house district rather
              than borough, so borough shapes carry no margin.
            </p>
          )}
        </div>

        {/* ── Census ── */}
        {c ? (
          <>
            <div>
              <SectionTitle
                right={
                  <a
                    href={censusCountyLink(selectedCounty)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[9px] uppercase tracking-wider text-ink-3 hover:text-ink"
                  >
                    Census profile ↗
                  </a>
                }
              >
                Population
              </SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Residents" value={int(c.pop)} />
                <Stat label="Density" value={c.density === null ? '—' : `${int(c.density)}/mi²`} />
                <Stat label="Land area" value={c.landArea === null ? '—' : `${int(c.landArea)} mi²`} />
                <Stat label="Households" value={int(c.households)} />
                <Stat label="Avg household" value={c.avgHHSize === null ? '—' : c.avgHHSize.toFixed(2)} />
                <Stat label="Housing units" value={int(c.housingUnits)} />
              </div>
            </div>

            <div>
              <SectionTitle>Age & sex</SectionTitle>
              <StackBar
                segments={[
                  { label: 'Under 18', value: c.pctUnder18 ?? 0, color: CATEGORICAL[0] },
                  { label: '18–64', value: c.pct18to64 ?? 0, color: CATEGORICAL[1] },
                  { label: '65+', value: c.pct65plus ?? 0, color: CATEGORICAL[3] },
                ]}
              />
              <div className="mt-2 grid grid-cols-4 gap-2">
                <Stat label="Under 18" value={pct(c.pctUnder18)} />
                <Stat label="18–64" value={pct(c.pct18to64)} />
                <Stat label="65+" value={pct(c.pct65plus)} />
                <Stat label="Female" value={pct(c.pctFemale)} />
              </div>
            </div>

            <div>
              <SectionTitle>Race & ethnicity</SectionTitle>
              <StackBar
                segments={[
                  { label: 'White NH', value: c.pctWhiteNH ?? 0, color: CATEGORICAL[0] },
                  { label: 'Black NH', value: c.pctBlackNH ?? 0, color: CATEGORICAL[1] },
                  { label: 'Hispanic', value: c.pctHispanic ?? 0, color: CATEGORICAL[3] },
                  { label: 'Asian NH', value: c.pctAsianNH ?? 0, color: CATEGORICAL[2] },
                  { label: 'Native NH', value: c.pctNativeNH ?? 0, color: CATEGORICAL[4] },
                  { label: 'Two or more', value: c.pctMultiNH ?? 0, color: CATEGORICAL[6] },
                ]}
              />
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Stat label="White NH" value={pct(c.pctWhiteNH)} />
                <Stat label="Black NH" value={pct(c.pctBlackNH)} />
                <Stat label="Hispanic" value={pct(c.pctHispanic)} />
                <Stat label="Asian NH" value={pct(c.pctAsianNH)} />
                <Stat label="Native NH" value={pct(c.pctNativeNH)} />
                <Stat label="Two or more" value={pct(c.pctMultiNH)} />
              </div>
            </div>

            <div>
              <SectionTitle>Education (adults 25+)</SectionTitle>
              <StackBar
                segments={[
                  { label: 'No HS diploma', value: c.pctNoHS ?? 0, color: CATEGORICAL[3] },
                  { label: 'HS only', value: c.pctHSonly ?? 0, color: CATEGORICAL[1] },
                  { label: 'Some college', value: c.pctSomeCollege ?? 0, color: CATEGORICAL[2] },
                  { label: "Bachelor's+", value: c.pctBAplus ?? 0, color: CATEGORICAL[0] },
                ]}
              />
              <div className="mt-2 grid grid-cols-4 gap-2">
                <Stat label="No HS" value={pct(c.pctNoHS)} />
                <Stat label="HS only" value={pct(c.pctHSonly)} />
                <Stat label="Some coll." value={pct(c.pctSomeCollege)} />
                <Stat label="BA or more" value={pct(c.pctBAplus)} />
              </div>
            </div>

            <div>
              <SectionTitle>Economy</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Median income" value={money(c.medianHHIncome)} />
                <Stat label="vs state" value={c.incomeVsState === null ? '—' : `${c.incomeVsState.toFixed(0)}%`} />
                <Stat label="Poverty" value={pct(c.pctPoverty)} />
                <Stat label="Child poverty" value={pct(c.pctPovertyKids)} />
                <Stat label="Unemployment" value={pct(c.unemployment)} />
                <Stat label="Labor force" value={compact(c.laborForce)} />
              </div>
            </div>

            <div>
              <SectionTitle>Households & cohorts</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Married" value={pct(c.pctMarried)} />
                <Stat label="With kids" value={pct(c.pctHHWithKids)} />
                <Stat label="Living alone" value={pct(c.pctLivingAlone)} />
                <Stat label="Veterans" value={pct(c.pctVeteran)} />
                <Stat label="Disability" value={pct(c.pctDisability)} />
                <Stat label="In college" value={pct(c.pctInCollege)} />
              </div>
            </div>

            <div>
              <SectionTitle>Population change (per 1,000/yr)</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Net migration" value={signedPct(c.netMigration)} accent={(c.netMigration ?? 0) > 0 ? '#1baf7a' : undefined} />
                <Stat label="Domestic" value={signedPct(c.domMigration)} />
                <Stat label="International" value={signedPct(c.intlMigration)} />
                <Stat label="Births" value={c.birthRate === null ? '—' : c.birthRate.toFixed(1)} />
                <Stat label="Deaths" value={c.deathRate === null ? '—' : c.deathRate.toFixed(1)} />
                <Stat
                  label="Natural change"
                  value={
                    c.birthRate === null || c.deathRate === null
                      ? '—'
                      : signedPct(c.birthRate - c.deathRate)
                  }
                />
              </div>
            </div>

            {c.crimeRate !== null && (
              <div>
                <SectionTitle right={<Chip tone="ghost">UCR</Chip>}>Public safety</SectionTitle>
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Index crime" value={`${int(c.crimeRate)}/100K`} />
                  <Stat label="Homicide" value={c.murderRate === null ? '—' : `${c.murderRate.toFixed(1)}/100K`} />
                  <Stat
                    label="Agency coverage"
                    value={c.crimeCoverage === null ? '—' : pct(c.crimeCoverage * 100, 0)}
                    hint="Share of county residents covered by reporting agencies; rates are suppressed below 70%."
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="rounded border border-dashed border-hairline px-3 py-2 text-[10.5px] text-ink-3">
            No census profile is available for this FIPS code.
          </p>
        )}

        {/* ── Towns ── */}
        <div>
          <SectionTitle right={<Chip tone="ghost">{townsHere.length} places</Chip>}>
            Towns & cities
          </SectionTitle>
          {townsHere.length ? (
            <>
              <div className="flex flex-wrap gap-1">
                {townsHere.slice(0, 60).map((t) => (
                  <button
                    key={`${t.n}-${t.x}`}
                    onClick={() => selectPlace(selectedPlace === t.n ? null : t.n)}
                    className={`rounded border px-1.5 py-0.5 text-[10px] transition ${
                      selectedPlace === t.n
                        ? 'border-white/40 bg-white/10 text-ink'
                        : 'border-hairline text-ink-2 hover:border-white/25 hover:text-ink'
                    }`}
                  >
                    {t.n}
                    {t.p !== null && (
                      <span className="ml-1 font-mono text-[9px] text-ink-3">{compact(t.p)}</span>
                    )}
                  </button>
                ))}
              </div>
              {townsHere.every((t) => t.p === null) && (
                <p className="mt-2 rounded border border-dashed border-hairline px-2.5 py-1.5 text-[9.5px] leading-snug text-ink-3">
                  Place-level population and demographics are not seeded offline — no verifiable
                  source was available to the build, and a wrong town population is worse than
                  none. <code className="text-ink-2">npm run sync:census</code> fills them from
                  api.census.gov.
                </p>
              )}
            </>
          ) : (
            <p className="text-[10.5px] text-ink-3">No places recorded for this county.</p>
          )}
        </div>

        <div className="border-t border-hairline pt-2 text-[9.5px] leading-snug text-ink-3/70">
          Census figures are ACS 5-year and population-estimate vintages stated in the provenance
          panel. Margins are two-party.
        </div>
      </div>
    </div>
  );
}

export { marginColor };
