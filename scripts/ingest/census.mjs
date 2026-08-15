/**
 * County census + demographic profile.
 *
 * Source: a compiled county-level table assembling US Census Bureau ACS
 * 5-year estimates, the Census Population Estimates Program, USDA ERS
 * education/poverty/income/unemployment series, and FBI UCR crime counts.
 *
 * VINTAGE: population estimates 2018; ACS 5-year 2014-2018. This is the
 * offline seed so the app is useful the moment it is cloned. `npm run
 * sync:census` re-derives every field below straight from api.census.gov at
 * the current ACS vintage and overwrites this file. The vintage travels with
 * the data and is rendered in the UI — never present these as current-year.
 */
import { fetchCached, csvToObjects, writeJSON, num, round, log } from '../lib/util.mjs';

const SRC =
  'https://raw.githubusercontent.com/JieYingWu/COVID-19_US_County-level_Summaries/master/data/counties.csv';

const F = {
  ruralUrban: 'Rural-urban_Continuum Code_2013',
  pop: 'POP_ESTIMATE_2018',
  netMig: 'R_NET_MIG_2018',
  intlMig: 'R_INTERNATIONAL_MIG_2018',
  domMig: 'R_DOMESTIC_MIG_2018',
  birthRate: 'R_birth_2018',
  deathRate: 'R_death_2018',
  eduLtHs: 'Percent of adults with less than a high school diploma 2014-18',
  eduHs: 'Percent of adults with a high school diploma only 2014-18',
  eduSome: "Percent of adults completing some college or associate's degree 2014-18",
  eduBa: "Percent of adults with a bachelor's degree or higher 2014-18",
  poverty: 'PCTPOVALL_2018',
  povertyKids: 'PCTPOV017_2018',
  income: 'Median_Household_Income_2018',
  incomeVsState: 'Med_HH_Income_Percent_of_State_Total_2018',
  unemp: 'Unemployment_rate_2018',
  laborForce: 'Civilian_labor_force_2018',
  housingUnits: 'Housing units',
  landArea: 'Area in square miles - Land area',
  density: 'Density per square mile of land area - Population',
  male: 'Total_Male',
  female: 'Total_Female',
  age0to17: 'Total_age0to17',
  age18to64: 'Total_age18to64',
  age65plus: 'Total_age65plus',
  households: 'Total households',
  hhSize: 'Total households!!Average household size',
  familyHh: 'Total households!!Family households (families)',
  aloneHh: 'Total households!!Nonfamily households!!Householder living alone',
  hhWithKids: 'Total households!!Households with one or more people under 18 years',
  marriedM: 'MARITAL STATUS!!Males 15 years and over!!Now married except separated',
  baseM: 'MARITAL STATUS!!Males 15 years and over',
  marriedF: 'MARITAL STATUS!!Females 15 years and over!!Now married except separated',
  baseF: 'MARITAL STATUS!!Females 15 years and over',
  inCollege:
    'SCHOOL ENROLLMENT!!Population 3 years and over enrolled in school!!College or graduate school',
  vetBase: 'VETERAN STATUS!!Civilian population 18 years and over',
  vets: 'VETERAN STATUS!!Civilian population 18 years and over!!Civilian veterans',
  disBase:
    'DISABILITY STATUS OF THE CIVILIAN NONINSTITUTIONALIZED POPULATION!!Total Civilian Noninstitutionalized Population',
  dis: 'DISABILITY STATUS OF THE CIVILIAN NONINSTITUTIONALIZED POPULATION!!Total Civilian Noninstitutionalized Population!!With a disability',
  // The source's own `crime_rate_per_100000` and `transit_scores` columns are
  // corrupt (Fulton County GA reads 8,261,767,583 per 100k). The underlying UCR
  // counts beside them are sound, so the rate is recomputed from those and
  // suppressed wherever agency reporting does not cover the county.
  crimePopCovered: 'COUNTY POPULATION-AGENCIES REPORT CRIMES',
  crimeIndex: 'Total number of UCR (Uniform Crime Report) index crimes reported including arson',
  murders: 'MURDER',
};

// Race/ethnicity arrives split by sex; pair them up and sum.
const RACE = {
  whiteNH: ['NHWA_MALE', 'NHWA_FEMALE'],
  blackNH: ['NHBA_MALE', 'NHBA_FEMALE'],
  nativeNH: ['NHIA_MALE', 'NHIA_FEMALE'],
  asianNH: ['NHAA_MALE', 'NHAA_FEMALE'],
  pacificNH: ['NHNA_MALE', 'NHNA_FEMALE'],
  multiNH: ['NHTOM_MALE', 'NHTOM_FEMALE'],
  hispanic: ['H_MALE', 'H_FEMALE'],
};

const pct = (part, whole) => (part === null || !whole ? null : round((100 * part) / whole, 1));

/**
 * UCR index-crime rate per 100k, computed from raw counts against the
 * population the reporting agencies actually cover. Counties where agencies
 * cover under 70% of residents get null rather than a rate that would read as
 * a real drop in crime when it is really a gap in reporting.
 */
function crimeStats(row, pop) {
  const covered = num(row[F.crimePopCovered]);
  const index = num(row[F.crimeIndex]);
  const murders = num(row[F.murders]);
  const coverage = covered && pop ? covered / pop : null;
  if (!covered || index === null || coverage === null || coverage < 0.7) {
    return { crimeRate: null, murderRate: null, crimeCoverage: coverage ? round(coverage, 2) : null };
  }
  return {
    crimeRate: round((index / covered) * 1e5, 0),
    murderRate: murders === null ? null : round((murders / covered) * 1e5, 1),
    crimeCoverage: round(coverage, 2),
  };
}
const sum2 = (row, keys) => {
  const a = num(row[keys[0]]);
  const b = num(row[keys[1]]);
  return a === null && b === null ? null : (a ?? 0) + (b ?? 0);
};

export async function run() {
  const rows = csvToObjects(await fetchCached(SRC, 'county-census.csv'));
  const out = {};
  let kept = 0;

  for (const row of rows) {
    const fips = String(row.FIPS || '').padStart(5, '0');
    // State-level rows end in 000 and would otherwise masquerade as counties.
    if (!/^\d{5}$/.test(fips) || fips.endsWith('000')) continue;

    const pop = num(row[F.pop]);
    const male = num(row[F.male]);
    const female = num(row[F.female]);
    const sexBase = (male ?? 0) + (female ?? 0) || pop;
    const ageBase =
      (num(row[F.age0to17]) ?? 0) + (num(row[F.age18to64]) ?? 0) + (num(row[F.age65plus]) ?? 0) ||
      pop;

    const race = {};
    let raceBase = 0;
    for (const [key, cols] of Object.entries(RACE)) {
      const v = sum2(row, cols);
      race[key] = v;
      raceBase += v ?? 0;
    }

    const married = (num(row[F.marriedM]) ?? 0) + (num(row[F.marriedF]) ?? 0);
    const maritalBase = (num(row[F.baseM]) ?? 0) + (num(row[F.baseF]) ?? 0);

    out[fips] = {
      pop,
      density: round(num(row[F.density]), 1),
      landArea: round(num(row[F.landArea]), 0),
      ruralUrban: num(row[F.ruralUrban]),

      // Age & sex
      pctUnder18: pct(num(row[F.age0to17]), ageBase),
      pct18to64: pct(num(row[F.age18to64]), ageBase),
      pct65plus: pct(num(row[F.age65plus]), ageBase),
      pctFemale: pct(female, sexBase),

      // Race & ethnicity (shares of the tabulated base)
      pctWhiteNH: pct(race.whiteNH, raceBase),
      pctBlackNH: pct(race.blackNH, raceBase),
      pctHispanic: pct(race.hispanic, raceBase),
      pctAsianNH: pct(race.asianNH, raceBase),
      pctNativeNH: pct(race.nativeNH, raceBase),
      pctMultiNH: pct(race.multiNH, raceBase),

      // Education — the single strongest correlate of recent vote swing
      pctBAplus: round(num(row[F.eduBa]), 1),
      pctSomeCollege: round(num(row[F.eduSome]), 1),
      pctHSonly: round(num(row[F.eduHs]), 1),
      pctNoHS: round(num(row[F.eduLtHs]), 1),
      pctInCollege: pct(num(row[F.inCollege]), pop),

      // Economy
      medianHHIncome: num(row[F.income]),
      incomeVsState: round(num(row[F.incomeVsState]), 1),
      pctPoverty: round(num(row[F.poverty]), 1),
      pctPovertyKids: round(num(row[F.povertyKids]), 1),
      unemployment: round(num(row[F.unemp]), 1),
      laborForce: num(row[F.laborForce]),

      // Households
      households: num(row[F.households]),
      avgHHSize: round(num(row[F.hhSize]), 2),
      pctFamilyHH: pct(num(row[F.familyHh]), num(row[F.households])),
      pctLivingAlone: pct(num(row[F.aloneHh]), num(row[F.households])),
      pctHHWithKids: pct(num(row[F.hhWithKids]), num(row[F.households])),
      pctMarried: pct(married, maritalBase),
      housingUnits: num(row[F.housingUnits]),

      // Cohorts that move independently of party ID
      pctVeteran: pct(num(row[F.vets]), num(row[F.vetBase])),
      pctDisability: pct(num(row[F.dis]), num(row[F.disBase])),

      // Migration (per 1,000 residents) — turnover reshapes an electorate
      netMigration: round(num(row[F.netMig]), 1),
      intlMigration: round(num(row[F.intlMig]), 1),
      domMigration: round(num(row[F.domMig]), 1),
      birthRate: round(num(row[F.birthRate]), 1),
      deathRate: round(num(row[F.deathRate]), 1),

      ...crimeStats(row, pop),
    };
    kept++;
  }

  await writeJSON('county-census.json', {
    meta: {
      source: 'US Census Bureau (ACS 5-year, PEP), USDA ERS, FBI UCR',
      compiledFrom: 'JieYingWu/COVID-19_US_County-level_Summaries',
      vintage: {
        population: '2018 (Census PEP)',
        acs: '2014-2018 (ACS 5-year)',
        education: '2014-2018',
        income: '2018 (SAIPE)',
        unemployment: '2018 (BLS LAUS)',
      },
      refresh: 'npm run sync:census — re-derives every field from api.census.gov at current vintage',
      generatedAt: new Date().toISOString().slice(0, 10),
      counties: kept,
    },
    counties: out,
  });

  log('census', `${kept} counties profiled`);
  return { counties: kept };
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
