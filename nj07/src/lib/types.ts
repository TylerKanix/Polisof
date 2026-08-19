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

/** The district's own House race as certified, over the towns it had then. */
export interface CertifiedRace {
  total: number;
  towns: number;
  townsStillInDistrict: number;
  cands: { name: string; party: PartyLetter | null; votes: number }[];
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
    pending: { id: string; label: string; why: string; expectedAt: string }[];
    unassignedVotes: number;
    districtUnassigned: { votes: number; rows: number; places: string[] };
    unresolvedRows: { row: string; votes: number }[];
    abbreviationCodes: { county: string; resolved: number; unresolved: string[] }[];
    droppedRows: { row: string; votes: number }[];
    sourceAnomalies: {
      municipality: string;
      county: string;
      race: string;
      votes: number;
      ballots: number;
      excess: number;
    }[];
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
  /** Keyed by election id, e.g. `g2018`. */
  certifiedHouse: Record<string, CertifiedRace>;
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

export interface CountyReturn {
  county: string;
  election: string;
  date: string;
  office: string;
  district?: number;
  label: string;
  modes: string[];
  contestTotal: number;
  candidates: {
    name: string;
    party: PartyLetter | null;
    total: number;
    byMode: number[];
  }[];
  source: { title: string; publisher: string; certified: string; note: string };
}

export interface CountyReturnsFile {
  meta: { generatedAt: string; note: string };
  returns: CountyReturn[];
  verifications: {
    id: string;
    what: string;
    against: string;
    figuresChecked: number;
    differences: number;
    note: string;
  }[];
  primary2026: {
    county: string;
    date: string;
    contestTotal: number;
    candidates: { name: string; votes: number }[];
    source: { title: string; publisher: string; certified: string; note: string };
  };
  wanted: { what: string; url: string; unlocks: string }[];
}
