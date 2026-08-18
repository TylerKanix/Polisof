/**
 * Map layers.
 *
 * Colour follows the job, as elsewhere in Polisof: partisan margins are
 * diverging around a true-neutral midpoint, everything else is a single-hue
 * sequential ramp, and territory is categorical.
 *
 * One layer is deliberately absent. Vote-by-mail share is the obvious thing to
 * draw from this data and it would be a lie: Hunterdon files mail ballots as
 * separate rows and four of the six counties fold them into the district
 * totals, so the map would show a 22-point cliff at the county line that is
 * paperwork, not behaviour. The filing table in the provenance panel carries
 * that instead.
 */
import { CATEGORICAL, marginColor, rampColor, NO_DATA, type RampName } from './palette';
import { DASH, int, pct, signedPct } from './format';
import {
  HOUSE_18,
  HOUSE_24,
  PRES_16,
  PRES_24,
  SEN_24,
  districtIn,
  marginOf,
  netContribution,
  overperformance,
  swing,
  turnoutRate,
} from './analysis';
import type { Municipality } from './types';

export interface Metric {
  id: string;
  label: string;
  group: 'Margin' | 'Movement' | 'Weight' | 'Territory';
  /** Short line under the layer name in the picker. */
  hint: string;
  kind: 'diverging' | 'sequential' | 'categorical';
  value: (m: Municipality) => number | null;
  format: (v: number | null) => string;
  /** Half-width of the diverging scale, in the metric's own units. */
  span?: number;
  ramp?: RampName;
  /** Legend end labels, low → high. */
  poles?: [string, string];
  note?: string;
}

const marginFmt = (v: number | null) =>
  v === null ? DASH : `${v > 0 ? 'R+' : v < 0 ? 'D+' : '±'}${Math.abs(v).toFixed(1)}`;

export const METRICS: Metric[] = [
  {
    id: 'house24',
    label: '2024 House — Kean v Altman',
    group: 'Margin',
    hint: 'The race these lines were last fought on',
    kind: 'diverging',
    value: (m) => marginOf(m, HOUSE_24),
    format: marginFmt,
    poles: ['Altman', 'Kean'],
  },
  {
    id: 'pres24',
    label: '2024 President — Trump v Harris',
    group: 'Margin',
    hint: 'The partisan baseline underneath the district',
    kind: 'diverging',
    value: (m) => marginOf(m, PRES_24),
    format: marginFmt,
    poles: ['Harris', 'Trump'],
  },
  {
    id: 'sen24',
    label: '2024 Senate — Bashaw v Kim',
    group: 'Margin',
    hint: 'A statewide Democrat who lost this district',
    kind: 'diverging',
    value: (m) => marginOf(m, SEN_24),
    format: marginFmt,
    poles: ['Kim', 'Bashaw'],
  },
  {
    id: 'pres16',
    label: '2016 President — Trump v Clinton',
    group: 'Margin',
    hint: 'The same towns, eight years earlier',
    kind: 'diverging',
    value: (m) => marginOf(m, PRES_16),
    format: marginFmt,
    poles: ['Clinton', 'Trump'],
  },
  {
    id: 'swing',
    label: 'Presidential swing, 2016 → 2024',
    group: 'Movement',
    hint: 'Red where the town moved right, blue where it moved left',
    kind: 'diverging',
    value: (m) => swing(m, PRES_16, PRES_24),
    format: (v) => (v === null ? DASH : `${signedPct(v)} pts`),
    span: 20,
    poles: ['toward D', 'toward R'],
    note:
      'This district realigned in both directions at once — the suburbs it took ' +
      'in from Union County moved left while its rural west moved hard right.',
  },
  {
    id: 'keanVsTrump',
    label: 'Kean against his own ticket',
    group: 'Movement',
    hint: 'Kean’s 2024 margin minus Trump’s, in the same town',
    kind: 'diverging',
    value: (m) => overperformance(m, HOUSE_24, PRES_24),
    format: (v) => (v === null ? DASH : `${signedPct(v)} pts`),
    span: 15,
    poles: ['ran behind', 'ran ahead'],
    note:
      'Where this is red, voters marked Kean and then marked Trump’s opponent, ' +
      'or stayed home at the top of the ballot. It is the incumbent’s personal ' +
      'vote, separated from his party’s.',
  },
  {
    id: 'net24',
    label: 'Net votes supplied, 2024 House',
    group: 'Weight',
    hint: 'Margin × size — where the result actually came from',
    kind: 'diverging',
    value: (m) => netContribution(m, HOUSE_24),
    format: (v) => (v === null ? DASH : `${v > 0 ? 'R+' : 'D+'}${int(Math.abs(v))}`),
    span: 6000,
    poles: ['for Altman', 'for Kean'],
    note: 'These sum, exactly, to the district’s 2024 margin.',
  },
  {
    id: 'turnout24',
    label: 'Turnout, 2024',
    group: 'Weight',
    hint: 'Ballots cast as a share of registered voters',
    kind: 'sequential',
    value: (m) => turnoutRate(m),
    format: (v) => pct(v),
    ramp: 'teal',
    poles: ['lower', 'higher'],
  },
  {
    id: 'ballots24',
    label: 'Ballots cast, 2024',
    group: 'Weight',
    hint: 'Raw electoral weight',
    kind: 'sequential',
    value: (m) => m.turnout.g2024?.ballots ?? null,
    format: (v) => int(v),
    ramp: 'amber',
    poles: ['smaller', 'larger'],
  },
  {
    id: 'density',
    label: 'Population density',
    group: 'Weight',
    hint: 'People per square mile — Census 2010',
    kind: 'sequential',
    value: (m) => (m.pop2010 && m.sqMiles ? m.pop2010 / m.sqMiles : null),
    format: (v) => (v === null ? DASH : `${int(v)}/sq mi`),
    ramp: 'violet',
    poles: ['rural', 'dense'],
    note:
      'Census 2010, carried in the state boundary file. It is the only ' +
      'population figure this build can reach offline, and it is fifteen years ' +
      'old — read it as terrain, not as an electorate.',
  },
  {
    id: 'district18',
    label: 'District in 2018',
    group: 'Territory',
    hint: 'Which seat each town voted in before the 2021 map',
    kind: 'categorical',
    value: (m) => districtIn(m, HOUSE_18),
    format: (v) => (v === null ? 'no House race on file' : `NJ-${String(v).padStart(2, '0')}`),
    note:
      'A third of this district was somewhere else two cycles ago. Historical ' +
      'House results below are that town’s own race — not always this seat’s.',
  },
];

export const METRIC_BY_ID = new Map(METRICS.map((m) => [m.id, m]));

/** The domain a sequential layer is stretched across, computed from the data. */
export function domainOf(metric: Metric, municipalities: Municipality[]): [number, number] {
  const values = municipalities
    .map(metric.value)
    .filter((v): v is number => v !== null && !Number.isNaN(v));
  if (!values.length) return [0, 1];
  return [Math.min(...values), Math.max(...values)];
}

/** Stable colour per district number, so the territory layer never reshuffles. */
export function districtColor(cd: number | null): string {
  if (cd === null) return NO_DATA;
  if (cd === 7) return '#f2f4f8';
  const order = [5, 10, 11, 12, 8, 6, 4];
  const i = order.indexOf(cd);
  return CATEGORICAL[(i < 0 ? cd : i) % CATEGORICAL.length];
}

export function colorFor(
  metric: Metric,
  value: number | null,
  domain: [number, number],
): string {
  if (value === null || Number.isNaN(value)) return NO_DATA;
  if (metric.kind === 'categorical') return districtColor(value);
  if (metric.kind === 'sequential') return rampColor(value, domain, metric.ramp ?? 'blue');
  // Diverging metrics whose units are not margin points are rescaled onto the
  // margin ramp so one legend reads for all of them.
  const span = metric.span;
  return marginColor(span ? (value / span) * 40 : value);
}
