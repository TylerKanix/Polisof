/**
 * County map layers.
 *
 * Each layer declares how to pull a value, how to color it, and — critically —
 * what the color MEANS. Partisan margin is the only diverging layer; every
 * demographic and economic layer is sequential, so a dark red county never
 * gets confused for a Republican one when the active layer is median income.
 */
import type { CountyCensus, CountyResult, ResultsFile } from './types';
import { countyMargin, swing, Y20, Y24 } from './analysis';
import { marginColor, rampColor, type RampName } from './palette';
import { compact, int, money, pct, signedPct } from './format';

export interface MetricContext {
  results: ResultsFile;
  census: Record<string, CountyCensus>;
}

export interface Metric {
  id: string;
  label: string;
  group: 'Politics' | 'People' | 'Economy' | 'Change';
  description: string;
  kind: 'diverging' | 'sequential';
  ramp?: RampName;
  domain?: [number, number];
  /** Null means "no measurement" and renders as the no-data hatch. */
  value: (fips: string, ctx: MetricContext) => number | null;
  format: (v: number | null) => string;
  /** Legend end labels, low to high. */
  legend: [string, string];
  source: string;
}

const cen = (fips: string, ctx: MetricContext) => ctx.census[fips];
const res = (fips: string, ctx: MetricContext): CountyResult | undefined =>
  ctx.results.counties[fips];

export const METRICS: Metric[] = [
  {
    id: 'margin24',
    label: 'Partisan margin (2024)',
    group: 'Politics',
    description:
      'Two-party presidential margin in 2024. Color solidity is partisanship: a coin-flip county sinks toward the background, a landslide county glows.',
    kind: 'diverging',
    value: (f, c) => {
      const r = res(f, c);
      return r ? countyMargin(r, Y24) : null;
    },
    format: (v) => (v === null ? '—' : `${v > 0 ? 'R' : 'D'}+${Math.abs(v).toFixed(1)}`),
    legend: ['D+40', 'R+40'],
    source: 'Certified county results, 2024',
  },
  {
    id: 'margin20',
    label: 'Partisan margin (2020)',
    group: 'Politics',
    description: 'Two-party presidential margin in 2020 — the prior baseline.',
    kind: 'diverging',
    value: (f, c) => {
      const r = res(f, c);
      return r ? countyMargin(r, Y20) : null;
    },
    format: (v) => (v === null ? '—' : `${v > 0 ? 'R' : 'D'}+${Math.abs(v).toFixed(1)}`),
    legend: ['D+40', 'R+40'],
    source: 'Certified county results, 2020',
  },
  {
    id: 'swing',
    label: 'Swing 2020 → 2024',
    group: 'Change',
    description:
      'Change in two-party margin between cycles. Red means the county moved right, blue means left — regardless of who actually won it.',
    kind: 'diverging',
    value: (f, c) => {
      const r = res(f, c);
      return r ? swing(r) : null;
    },
    format: (v) => (v === null ? '—' : `${v > 0 ? 'R' : 'D'}+${Math.abs(v).toFixed(1)} shift`),
    legend: ['D shift', 'R shift'],
    source: 'Derived from 2020 and 2024 results',
  },
  {
    id: 'turnout-change',
    label: 'Turnout change',
    group: 'Change',
    description: 'Percent change in total votes cast, 2020 to 2024.',
    kind: 'sequential',
    ramp: 'teal',
    domain: [-20, 30],
    value: (f, c) => {
      const r = res(f, c);
      const a = r?.t[Y20];
      const b = r?.t[Y24];
      return a && b ? ((b - a) / a) * 100 : null;
    },
    format: (v) => (v === null ? '—' : `${signedPct(v)}%`),
    legend: ['−20%', '+30%'],
    source: 'Derived from 2020 and 2024 results',
  },
  {
    id: 'votes',
    label: 'Votes cast (2024)',
    group: 'Politics',
    description: 'Raw ballots cast — where the mass of the electorate actually is.',
    kind: 'sequential',
    ramp: 'blue',
    domain: [0, 300000],
    value: (f, c) => res(f, c)?.t[Y24] ?? null,
    format: (v) => (v === null ? '—' : compact(v)),
    legend: ['0', '300K+'],
    source: 'Certified county results, 2024',
  },
  {
    id: 'density',
    label: 'Population density',
    group: 'People',
    description:
      'Residents per square mile — the single strongest structural predictor of partisan lean in modern US elections.',
    kind: 'sequential',
    ramp: 'blue',
    domain: [0, 3000],
    value: (f, c) => cen(f, c)?.density ?? null,
    format: (v) => (v === null ? '—' : `${int(v)}/sq mi`),
    legend: ['Rural', '3,000+'],
    source: 'Census population estimates',
  },
  {
    id: 'ba',
    label: 'Bachelor’s degree or higher',
    group: 'People',
    description:
      'Share of adults 25+ with a four-year degree — the axis along which the two parties’ coalitions have realigned since 2012.',
    kind: 'sequential',
    ramp: 'violet',
    domain: [8, 55],
    value: (f, c) => cen(f, c)?.pctBAplus ?? null,
    format: (v) => pct(v),
    legend: ['8%', '55%+'],
    source: 'ACS 5-year',
  },
  {
    id: 'age65',
    label: 'Age 65 and over',
    group: 'People',
    description: 'Share of residents 65+. Older electorates turn out at higher rates in midterms.',
    kind: 'sequential',
    ramp: 'amber',
    domain: [8, 35],
    value: (f, c) => cen(f, c)?.pct65plus ?? null,
    format: (v) => pct(v),
    legend: ['8%', '35%+'],
    source: 'ACS 5-year',
  },
  {
    id: 'white',
    label: 'Non-Hispanic white share',
    group: 'People',
    description: 'Share of residents who are white, non-Hispanic.',
    kind: 'sequential',
    ramp: 'teal',
    domain: [10, 98],
    value: (f, c) => cen(f, c)?.pctWhiteNH ?? null,
    format: (v) => pct(v),
    legend: ['10%', '98%'],
    source: 'ACS 5-year',
  },
  {
    id: 'black',
    label: 'Black share',
    group: 'People',
    description: 'Share of residents who are Black, non-Hispanic.',
    kind: 'sequential',
    ramp: 'violet',
    domain: [0, 70],
    value: (f, c) => cen(f, c)?.pctBlackNH ?? null,
    format: (v) => pct(v),
    legend: ['0%', '70%+'],
    source: 'ACS 5-year',
  },
  {
    id: 'hispanic',
    label: 'Hispanic share',
    group: 'People',
    description: 'Share of residents who are Hispanic or Latino, any race.',
    kind: 'sequential',
    ramp: 'amber',
    domain: [0, 80],
    value: (f, c) => cen(f, c)?.pctHispanic ?? null,
    format: (v) => pct(v),
    legend: ['0%', '80%+'],
    source: 'ACS 5-year',
  },
  {
    id: 'income',
    label: 'Median household income',
    group: 'Economy',
    description: 'Median household income in the most recent estimate year.',
    kind: 'sequential',
    ramp: 'teal',
    domain: [28000, 110000],
    value: (f, c) => cen(f, c)?.medianHHIncome ?? null,
    format: (v) => (v === null ? '—' : money(v)),
    legend: ['$28K', '$110K+'],
    source: 'Census SAIPE',
  },
  {
    id: 'poverty',
    label: 'Poverty rate',
    group: 'Economy',
    description: 'Share of residents below the federal poverty line.',
    kind: 'sequential',
    ramp: 'amber',
    domain: [3, 35],
    value: (f, c) => cen(f, c)?.pctPoverty ?? null,
    format: (v) => pct(v),
    legend: ['3%', '35%+'],
    source: 'Census SAIPE',
  },
  {
    id: 'unemployment',
    label: 'Unemployment rate',
    group: 'Economy',
    description: 'Civilian unemployment rate.',
    kind: 'sequential',
    ramp: 'amber',
    domain: [1.5, 10],
    value: (f, c) => cen(f, c)?.unemployment ?? null,
    format: (v) => pct(v),
    legend: ['1.5%', '10%+'],
    source: 'BLS LAUS',
  },
  {
    id: 'migration',
    label: 'Net migration',
    group: 'Change',
    description:
      'Net migrants per 1,000 residents per year. Sustained in-migration reshapes an electorate faster than persuasion does.',
    kind: 'diverging',
    value: (f, c) => {
      const v = cen(f, c)?.netMigration;
      // Rescaled onto the diverging ramp's ±40 range; in-migration reads blue.
      return v === null || v === undefined ? null : -v * 2;
    },
    format: (v) => (v === null ? '—' : `${signedPct(-v / 2, 1)} per 1,000`),
    legend: ['In-migration', 'Out-migration'],
    source: 'Census population estimates',
  },
  {
    id: 'veterans',
    label: 'Veteran share',
    group: 'People',
    description: 'Share of adults 18+ who are military veterans.',
    kind: 'sequential',
    ramp: 'teal',
    domain: [2, 18],
    value: (f, c) => cen(f, c)?.pctVeteran ?? null,
    format: (v) => pct(v),
    legend: ['2%', '18%+'],
    source: 'ACS 5-year',
  },
];

export const METRIC_BY_ID = Object.fromEntries(METRICS.map((m) => [m.id, m]));

export function metricColor(metric: Metric, fips: string, ctx: MetricContext): string {
  const v = metric.value(fips, ctx);
  if (metric.kind === 'diverging') return marginColor(v);
  return rampColor(v, metric.domain ?? [0, 100], metric.ramp ?? 'blue');
}
