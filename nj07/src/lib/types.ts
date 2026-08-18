/** Shapes of the generated datasets under public/data. */

export type PartyLetter = 'D' | 'R' | 'I' | 'L' | 'G' | 'C' | 'S' | 'O';

export type VoteMode = 'machine' | 'mail' | 'early' | 'provisional' | 'overseas';

export interface CandidateResult {
  name: string;
  party: PartyLetter | null;
  votes: number;
  /** Only the counties that file ballots separately populate this. */
  byMode: Partial<Record<VoteMode, number>>;
  partyConflict?: string[];
}

export interface RaceResult {
  /** The congressional district this municipality voted in, for House races. */
  cd: number | null;
  total: number;
  byMode: Partial<Record<VoteMode, number>>;
  cands: CandidateResult[];
}

export interface Turnout {
  registered: number | null;
  ballots: number | null;
  byMode: Partial<Record<VoteMode, number>> | null;
}

export interface Municipality {
  geoid: string;
  name: string;
  county: string;
  type: string;
  sqMiles: number | null;
  /** Census 2010, carried in the state boundary file. Not a current estimate. */
  pop2010: number | null;
  inDistrict: 'whole' | 'split';
  districtShare: number;
  otherDistricts: { cd: number; share: number }[];
  /** Keyed `${electionId}/${office}`, e.g. `g2024/ushouse`. */
  results: Record<string, RaceResult>;
  turnout: Record<string, Turnout>;
}

export interface DistrictTotal {
  total: number;
  /** True when split municipalities were prorated into this figure. */
  prorated: boolean;
  municipalities: number;
  cands: { name: string; party: PartyLetter | null; votes: number }[];
}

export interface ElectionMeta {
  id: string;
  year: number;
  date: string;
  label: string;
  level: 'precinct' | 'municipal';
}

export interface DistrictFile {
  meta: {
    state: string;
    district: number;
    generatedAt: string;
    elections: ElectionMeta[];
    membership: {
      method: string;
      municipalities: number;
      whole: number;
      split: number;
      counties: string[];
    };
    gaps: { id: string; what: string; why: string }[];
    unassignedVotes: number;
    districtUnassigned: { votes: number; rows: number; places: string[] };
    unresolvedRows: { row: string; votes: number }[];
    abbreviationCodes: { county: string; resolved: number; unresolved: string[] }[];
    voteModeFiling: Record<
      string,
      { total: number; separates: string[]; shares: Record<string, number> }
    >;
    spellingCorrections: {
      election: string;
      county: string;
      wrote: string;
      read: string;
      how: 'spelling' | 'section';
    }[];
  };
  district: Record<string, DistrictTotal>;
  municipalities: Municipality[];
  unassigned: unknown[];
}

export interface Frame {
  bounds: [number, number, number, number];
  centroid: [number, number];
  municipalities: number;
  simplification: {
    quantile: number;
    quantization: number;
    verticesBefore: number;
    verticesAfter: number;
    areaLoss: number;
  };
  source: string;
}

export interface RaceCandidate {
  id: string;
  name: string;
  party: PartyLetter;
  status: 'incumbent' | 'nominee' | 'declared';
  birthYear: number | null;
  office: string | null;
  since?: number;
  history: string[];
  elected: { year: number; note: string }[];
  nominated: string;
  note: string;
  sources: { label: string; url: string }[];
}

export interface RaceFile {
  meta: { verifiedThrough: string; generatedAt: string; warning: string };
  race: {
    state: string;
    district: number;
    cycle: number;
    office: string;
    electionDay: string;
    primaryDay: string;
    open: boolean;
    rating: { label: string; by: string; url: string; note: string };
    candidates: RaceCandidate[];
    primary: {
      date: string;
      D: { name: string; share: number | null; note?: string }[];
      R: { name: string; share: number | null; note?: string }[];
      source: { label: string; url: string };
      caveat: string;
    };
    liveSources: { id: string; label: string; why: string; url: string; linkLabel: string }[];
  };
}

export interface Manifest {
  generatedAt: string;
  sources: {
    id: string;
    label: string;
    source: string;
    url: string | null;
    license: string;
    vintage: string;
  }[];
}
