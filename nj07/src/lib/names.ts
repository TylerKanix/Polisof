/**
 * Display names for municipalities.
 *
 * A map label reading `Bernards Township` is mostly the word "Township", so
 * labels drop the type. Two towns in this district share a stem, though —
 * Morris has a Mendham Borough beside a Mendham Township, Hunterdon has
 * Clinton Town beside Clinton Township — and dropping the type there puts two
 * identical labels on adjacent polygons, which is worse than a long label.
 * Those keep an abbreviated type.
 */
import type { Municipality } from './types';

const TYPE_RE = / (Township|Borough|City|Town|Village)$/;

const ABBREV: Record<string, string> = {
  Township: 'Twp',
  Borough: 'Boro',
  Village: 'Vlg',
  City: 'City',
  Town: 'Town',
};

export function shortNames(municipalities: Municipality[]): Map<string, string> {
  const stems = new Map<string, number>();
  for (const m of municipalities) {
    const stem = m.name.replace(TYPE_RE, '');
    stems.set(stem, (stems.get(stem) ?? 0) + 1);
  }
  return new Map(
    municipalities.map((m) => {
      const match = m.name.match(TYPE_RE);
      const stem = m.name.replace(TYPE_RE, '');
      const ambiguous = (stems.get(stem) ?? 0) > 1;
      return [m.geoid, ambiguous && match ? `${stem} ${ABBREV[match[1]]}` : stem];
    }),
  );
}
