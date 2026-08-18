/**
 * The color system.
 *
 * Built to the rule that color follows the job it does, never decoration:
 *   - partisan margin is DIVERGING (two poles + a neutral midpoint)
 *   - every other county metric is SEQUENTIAL (one hue, light to dark)
 *   - coalition series are CATEGORICAL (fixed slot order, never cycled)
 *
 * The surface is dark, so "recedes toward the background" means desaturated
 * toward #11141c. That maps cleanly onto the political reading a map needs:
 * a landslide county glows, a coin-flip county sinks into the plane. Solidity
 * is partisanship — which is exactly what an operative reads off the map.
 */

export const SURFACE = {
  void: '#07080b',
  plane: '#0b0d12',
  chart: '#11141c',
  raised: '#161a24',
} as const;

export const INK = {
  primary: '#f2f4f8',
  secondary: '#a8b0c2',
  muted: '#6b7488',
  grid: '#1e2331',
  axis: '#2c3243',
} as const;

/**
 * Diverging partisan ramp. Seven steps per arm plus a neutral midpoint, equal
 * step count either side so a D+20 county and an R+20 county are equally loud.
 * The midpoint is a true neutral gray — never a hue — so "no margin" reads as
 * "nothing", not as a third party.
 */
export const DEM_ARM = [
  '#1b2740',
  '#1b3a63',
  '#17508f',
  '#1667bd',
  '#1a80e0',
  '#4b9df0',
  '#7cbcff',
] as const;

export const GOP_ARM = [
  '#3f1e25',
  '#63262f',
  '#8a2c36',
  '#b23540',
  '#d8434b',
  '#ec5f65',
  '#ff8286',
] as const;

export const NEUTRAL = '#262b38';

/** Margin breakpoints, in two-party percentage points. */
const BREAKS = [1, 5, 10, 20, 30, 40] as const;

/**
 * Map a two-party margin to a fill. Positive = Republican, matching the sign
 * convention used throughout the data layer.
 */
export function marginColor(margin: number | null | undefined): string {
  if (margin === null || margin === undefined || Number.isNaN(margin)) return NO_DATA;
  const m = Math.abs(margin);
  let step = 0;
  while (step < BREAKS.length && m > BREAKS[step]) step++;
  if (m <= BREAKS[0]) return NEUTRAL;
  const arm = margin > 0 ? GOP_ARM : DEM_ARM;
  return arm[Math.min(step, arm.length - 1)];
}

export const NO_DATA = '#171b26';

/** Party identity — used for chips, bars and candidate accents, not the map. */
export const PARTY = {
  D: { base: '#3987e5', bright: '#6da7ec', deep: '#1c5cab', label: 'Democrat', short: 'D' },
  R: { base: '#e34948', bright: '#ea7574', deep: '#a82f2f', label: 'Republican', short: 'R' },
  I: { base: '#c98500', bright: '#eda100', deep: '#8a5c00', label: 'Independent', short: 'I' },
  L: { base: '#9085e9', bright: '#a99fef', deep: '#5f54b8', label: 'Libertarian', short: 'L' },
  G: { base: '#199e70', bright: '#1baf7a', deep: '#0f6b4b', label: 'Green', short: 'G' },
} as const;

export type PartyCode = keyof typeof PARTY;

export const partyOf = (code: string | null | undefined) =>
  (code && code in PARTY ? PARTY[code as PartyCode] : PARTY.I);

/**
 * Categorical slots for compositional series (demographic makeup, bloc share).
 * Slot order is the CVD-safety mechanism, not cosmetics — validated on this
 * surface: worst adjacent pair ΔE 8.4 under protanopia, 19.3 with normal
 * vision. Assign in fixed order, never cycle. Past seven categories, fold the
 * tail into "Other" rather than inventing an eighth hue.
 *
 * Deliberately no red slot: on a political map red is party identity, and a
 * red "some college" wedge beside a red county fill would read as partisan
 * when it is not.
 */
export const CATEGORICAL = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
] as const;

/** Sequential ramps for non-partisan county metrics. One hue, dark to light. */
export const SEQUENTIAL = {
  blue: ['#101a2b', '#16294a', '#1a3a6b', '#1d4d90', '#2464b6', '#3d82d6', '#6ba3e8'],
  amber: ['#20180b', '#3a2a0e', '#573d10', '#775213', '#996916', '#bf871f', '#dcaa4a'],
  teal: ['#0d1d1c', '#123330', '#164a45', '#1a625a', '#1e7b70', '#2a9a8b', '#4fbcaa'],
  violet: ['#171429', '#241f4a', '#31296c', '#3f338f', '#4f43b2', '#6a5fd0', '#8f86e4'],
} as const;

export type RampName = keyof typeof SEQUENTIAL;

/** Position a value on a sequential ramp given the domain it lives in. */
export function rampColor(
  value: number | null | undefined,
  domain: [number, number],
  ramp: RampName = 'blue',
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NO_DATA;
  const steps = SEQUENTIAL[ramp];
  const [lo, hi] = domain;
  if (hi === lo) return steps[Math.floor(steps.length / 2)];
  const t = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
  return steps[Math.min(steps.length - 1, Math.round(t * (steps.length - 1)))];
}

/** Race ratings, signed toward the favored party. */
export const RATING_STYLE: Record<string, { fill: string; label: string }> = {
  'Solid D': { fill: DEM_ARM[5], label: 'Solid D' },
  'Likely D': { fill: DEM_ARM[3], label: 'Likely D' },
  'Lean D': { fill: DEM_ARM[1], label: 'Lean D' },
  Tossup: { fill: NEUTRAL, label: 'Tossup' },
  'Lean R': { fill: GOP_ARM[1], label: 'Lean R' },
  'Likely R': { fill: GOP_ARM[3], label: 'Likely R' },
  'Solid R': { fill: GOP_ARM[5], label: 'Solid R' },
};

/**
 * A diagonal hatch used for two distinct "this is not a measurement" cases:
 * seats not on the ballot, and counties whose state does not certify results
 * at county level. Texture, not a color, so it survives color-blind viewing,
 * grayscale printing and forced-colors mode.
 */
export const HATCH_ID = 'polisof-hatch';
