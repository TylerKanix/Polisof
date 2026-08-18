/** Office, party and candidate-name normalisation across four clerk formats. */

/** Canonical office keys, in ballot order. */
export const OFFICES = ['president', 'ussenate', 'ushouse'];

export const OFFICE_LABEL = {
  president: 'President',
  ussenate: 'U.S. Senate',
  ushouse: 'U.S. House',
};

/**
 * Read a canonical office out of whatever the clerk wrote. Union County spells
 * the House race `Member of House of Representatives 7th Congressional
 * District` and leaves the district column empty, so the district has to come
 * back out of the office string too.
 */
export function readOffice(rawOffice, rawDistrict) {
  const s = String(rawOffice ?? '').trim();
  const lower = s.toLowerCase();
  let district = String(rawDistrict ?? '').trim() || null;
  if (!district) {
    const m = lower.match(/(\d+)\s*(?:st|nd|rd|th)?\s+congressional district/);
    if (m) district = m[1];
    else {
      const cd = lower.match(/\bcd\s*(\d+)\b/);
      if (cd) district = cd[1];
    }
  }

  if (/registered voters/.test(lower)) return { office: 'registered', district: null };
  if (/ballots cast/.test(lower)) return { office: 'ballots', district: null };
  if (/president/.test(lower)) return { office: 'president', district: null };
  // Sussex files the office as `U.S.House`, with no space. Whitespace between
  // the abbreviation and the chamber is optional everywhere for that reason.
  if (/u\.?\s*s\.?\s*senate|united states senate/.test(lower)) {
    return { office: 'ussenate', district: null };
  }
  if (/u\.?\s*s\.?\s*house|house of representatives|congressional district/.test(lower)) {
    return { office: 'ushouse', district };
  }
  return { office: null, district: null };
}

const PARTY_CODES = new Map(
  Object.entries({
    dem: 'D', democrat: 'D', democratic: 'D', 'democratic party': 'D',
    rep: 'R', republican: 'R', 'republican party': 'R', gop: 'R',
    grn: 'G', green: 'G',
    lib: 'L', libertarian: 'L',
    con: 'C', constitution: 'C',
    soc: 'S', socialist: 'S',
  }),
);

/**
 * Party letter. Union prefixes the candidate with it (`DEM Sue ALTMAN`) and
 * Morris omits it entirely, so both the party column and the name are read.
 * `NON` covers the by-petition lines New Jersey allows; they are independents
 * as far as this app is concerned, and their slogan-party is not a party.
 */
export function readParty(rawParty, rawCandidate) {
  const p = String(rawParty ?? '').trim().toLowerCase();
  if (PARTY_CODES.has(p)) return PARTY_CODES.get(p);
  const prefix = String(rawCandidate ?? '').trim().match(/^(DEM|REP|NON|GRN|LIB|CON|SOC)\s+/i);
  if (prefix) {
    const key = prefix[1].toLowerCase();
    if (PARTY_CODES.has(key)) return PARTY_CODES.get(key);
    if (key === 'non') return 'I';
  }
  if (p === 'non' || p === 'independent' || p === 'ind') return 'I';
  if (p === '') return null;
  return 'O';
}

const LOWER_WORDS = new Set(['de', 'la', 'van', 'von', 'del', 'di', 'da']);

/**
 * Clerks type surnames in caps (`Thomas H. KEAN, JR.`) and Union prefixes the
 * party. Display names are recased rather than retyped, so the name on screen
 * still traces to the certification.
 */
export function properName(raw) {
  let s = String(raw ?? '').trim().replace(/^(DEM|REP|NON|GRN|LIB|CON|SOC)\s+/i, '');
  if (!s) return '';
  if (/^write[- ]?ins?$/i.test(s)) return 'Write-in';
  // Only recase words that are shouted; leave mixed-case spellings alone.
  return s
    .split(/(\s+|-)/)
    .map((word) => {
      if (/^\s+$/.test(word) || word === '-') return word;
      if (word !== word.toUpperCase()) return word;
      const lower = word.toLowerCase();
      const bare = lower.replace(/[.,]/g, '');
      if (LOWER_WORDS.has(bare)) return lower;
      // Roman-numeral suffixes are already right in caps.
      if (/^(ii|iii|iv|vi{0,3})$/.test(bare)) return word;
      const cased = lower.replace(/(^|['’])([a-z])/g, (_, p, c) => p + c.toUpperCase());
      // `MCIVER` is McIver. Mac- is left alone: Mack and MacDonald are not the
      // same shape and guessing between them renames people.
      return /^mc[a-z]/.test(lower)
        ? 'Mc' + lower[2].toUpperCase() + lower.slice(3)
        : cased;
    })
    .join('');
}

export const isWriteIn = (name) => /^write[- ]?ins?$/i.test(String(name ?? '').trim());

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/**
 * A stable identity for one candidate across counties.
 *
 * The same person is typed four ways across twenty-one clerks — `Thomas H.
 * Kean, Jr.` in Morris, `Thomas H. Kean Jr.` in Sussex — and several counties
 * leave the party column empty, so a naive key splits one candidate into two
 * rows that each look like a losing campaign. Punctuation, middle initials and
 * generational suffixes are dropped; what is left is first and last name,
 * which is enough to be unique inside a single race and shallow enough not to
 * merge two different people.
 */
export function candidateKey(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !NAME_SUFFIXES.has(w))
    .join(' ');
}
