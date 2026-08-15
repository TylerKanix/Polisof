/** Shapes of the generated datasets under public/data. */

export type PartyLetter = 'D' | 'R' | 'I' | 'L' | 'G';

export interface OfficeStint {
  label: string;
  seat: string;
  start: string;
  end: string;
  terms: number;
}

export interface CandidateRecord {
  bioguide: string;
  fecIds: string[];
  fullName: string;
  birthday: string | null;
  history: OfficeStint[];
  yearsInCongress: number;
  chamber: 'sen' | 'rep' | null;
  district: number | null;
  recordState: string | null;
  sittingMember: boolean;
}

/** Campaign finance, filled by `npm run sync:fec`. Null means unreported. */
export interface Finance {
  cashOnHand: number | null;
  raised: number | null;
  spent: number | null;
  debts: number | null;
  coverageEnd: string | null;
  fecCandidateId: string | null;
  source: string;
  asOf: string;
}

export interface Candidate {
  id: string;
  name: string;
  party: PartyLetter;
  status: 'incumbent' | 'declared' | 'potential';
  seatOrder: number;
  office: string | null;
  occupation: string | null;
  note: string | null;
  appointed: boolean;
  birthYear: number | null;
  birthYearConfidence: string | null;
  record: CandidateRecord | null;
  finance: Finance | null;
}

export interface SeatHolder {
  name: string;
  bioguide: string | null;
  party: PartyLetter | null;
  appointed: boolean;
  how: string;
  retiring: boolean;
  yearsInCongress: number | null;
  birthday: string | null;
}

export interface Race {
  id: string;
  state: string;
  stateFips: string;
  stateName: string;
  seatClass: number;
  special: boolean;
  open: boolean;
  openReason: string | null;
  specialReason: string | null;
  note: string | null;
  fieldUnverified: string | null;
  seatHolder: SeatHolder;
  candidates: Candidate[];
}

export interface RacesFile {
  meta: {
    cycle: number;
    electionDay: string;
    verifiedThrough: string;
    generatedAt: string;
    warning: string;
    rosterDrift: string[];
    races: number;
    candidates: number;
    candidatesResolvedToRecord: number;
  };
  races: Race[];
}

/** Per-county vote totals. Index order matches meta.years: [2016, 2020, 2024]. */
export interface CountyResult {
  n: string;
  s: string;
  r: (number | null)[];
  d: (number | null)[];
  t: (number | null)[];
}

export interface StateTotals {
  r: number[];
  d: number[];
  t: number[];
  counties: number;
  countySubdivided?: boolean;
}

export interface ResultsFile {
  meta: {
    years: number[];
    source: string;
    note: string;
    countiesWithResults: number;
    countyShapesWithoutResults: number;
  };
  counties: Record<string, CountyResult>;
  states: Record<string, StateTotals>;
}

export interface CountyCensus {
  pop: number | null;
  density: number | null;
  landArea: number | null;
  ruralUrban: number | null;
  pctUnder18: number | null;
  pct18to64: number | null;
  pct65plus: number | null;
  pctFemale: number | null;
  pctWhiteNH: number | null;
  pctBlackNH: number | null;
  pctHispanic: number | null;
  pctAsianNH: number | null;
  pctNativeNH: number | null;
  pctMultiNH: number | null;
  pctBAplus: number | null;
  pctSomeCollege: number | null;
  pctHSonly: number | null;
  pctNoHS: number | null;
  pctInCollege: number | null;
  medianHHIncome: number | null;
  incomeVsState: number | null;
  pctPoverty: number | null;
  pctPovertyKids: number | null;
  unemployment: number | null;
  laborForce: number | null;
  households: number | null;
  avgHHSize: number | null;
  pctFamilyHH: number | null;
  pctLivingAlone: number | null;
  pctHHWithKids: number | null;
  pctMarried: number | null;
  housingUnits: number | null;
  pctVeteran: number | null;
  pctDisability: number | null;
  netMigration: number | null;
  intlMigration: number | null;
  domMigration: number | null;
  birthRate: number | null;
  deathRate: number | null;
  crimeRate: number | null;
  murderRate: number | null;
  crimeCoverage: number | null;
}

export interface CensusFile {
  meta: {
    source: string;
    vintage: Record<string, string>;
    refresh: string;
    counties: number;
  };
  counties: Record<string, CountyCensus>;
}

export interface Place {
  n: string;
  c: string | null;
  y: number;
  x: number;
  p: number | null;
}

export interface PlacesFile {
  state: string;
  count: number;
  withPopulation: number;
  places: Place[];
}

export interface StateMeta {
  fips: string;
  abbr: string;
  name: string;
  bounds: [number, number, number, number];
  centroid: [number, number];
  lonlat: [number, number];
  area: number;
}

export interface Manifest {
  generatedAt: string;
  sources: {
    id: string;
    label: string;
    source: string;
    license: string;
    vintage: string;
  }[];
}
