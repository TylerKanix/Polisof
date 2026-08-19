/** Office, party and candidate-name normalisation across four clerk formats. */

/** Canonical office keys, in ballot order. */
export const OFFICES = ['president', 'governor', 'ussenate', 'ushouse'];

export const OFFICE_LABEL = {
  president: 'President',
  governor: 'Governor',
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
  // Governor is a statewide race, so it needs no district — and `Lieutenant
  // Governor` must not match it, since the two run on one line in New Jersey.
  if (/\bgovernor\b/.test(lower) && !/lieutenant|lt\.?\s+governor/.test(lower)) {
    return { office: 'governor', district: null };
  }
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

/**
 * Party, as New Jersey files it.
 *
 * Only two parties appear on a New Jersey ballot as parties. Everyone else
 * runs by petition under a **slogan** of their own choosing — `For the
 * People`, `Make It Simple`, `Women of Power` — printed in the same column,
 * and emphatically not a party. A few of those slogans are the name of a real
 * party, and those are read as the party they name; the rest mean
 * "independent", not "some eighth party".
 */
const PARTY_CODES = new Map(
  Object.entries({
    // Camden files the bare letter, which is why the single-letter codes are
    // here: without them its Harris and Trump rows fell through to the slogan
    // branch and came back independent.
    d: 'D', dem: 'D', democrat: 'D', democratic: 'D', 'democratic party': 'D',
    r: 'R', rep: 'R', republican: 'R', 'republican party': 'R', gop: 'R',
    g: 'G', grn: 'G', green: 'G', 'green party': 'G',
    l: 'L', lib: 'L', libertarian: 'L', 'libertarian party': 'L',
    con: 'C', cst: 'C', constitution: 'C', 'constitution party': 'C',
    swp: 'S', soc: 'S', socialist: 'S', 'socialist party': 'S',
    'socialist workers party': 'S',
    'socialism and liberation': 'S',
    'workers world party': 'S',
    i: 'I', ind: 'I', independent: 'I',
  }),
);

/**
 * `NON` is Union County's marker for a line nominated by petition rather than
 * through a party primary. It records how someone reached the ballot, not what
 * they are, so it must yield no party at all.
 */
const BY_PETITION = /^(NON|PET)$/i;

/**
 * Party letter, or null when the source offers no usable evidence.
 *
 * Null matters more than it looks. Party is settled race-wide from every
 * county that filed one, so a county that files only a petition marker must
 * contribute *nothing* rather than a wrong answer that then competes for the
 * majority — otherwise a candidate five counties call Green and one calls
 * `NON` comes out as two different people's worth of party.
 */
export function readParty(rawParty, rawCandidate) {
  const p = String(rawParty ?? '').trim().toLowerCase();
  if (PARTY_CODES.has(p)) return PARTY_CODES.get(p);

  const prefix = String(rawCandidate ?? '').trim().match(/^([A-Za-z]{3})\s+/);
  if (prefix) {
    const key = prefix[1].toLowerCase();
    if (BY_PETITION.test(prefix[1])) return null;
    if (PARTY_CODES.has(key)) return PARTY_CODES.get(key);
  }
  if (BY_PETITION.test(p)) return null;
  if (p === '') return null;
  // A slogan sitting in the party column is a by-petition candidate — an
  // independent, not a member of some eighth party.
  return 'I';
}

/**
 * Rows that are ballot accounting, not candidates.
 *
 * Warren files `Under Votes` and `Over Votes` as if they were people — 4,336
 * of them across this district. Counted as a candidate they inflate the
 * denominator, so every real candidate's share reads low. They are dropped,
 * and the ingest reports what it dropped.
 */
export function isAdministrative(name) {
  return /^(under|over)\s*votes?$|^(total|blank|void|spoiled|invalid|unresolved)\b|^no candidate|^personal choice$/i.test(
    String(name ?? '').trim(),
  );
}

/**
 * Four counties print the whole ticket — `Kamala D. Harris and Tim Walz`,
 * `Donald J. TRUMP - JD VANCE` — while the rest print the head of the ticket
 * alone. Left alone that splits one candidate's statewide vote across two
 * identities. The running mate is dropped so a presidential row means the same
 * thing in every county.
 */
export function headOfTicket(name) {
  return String(name ?? '')
    .split(/\s+(?:and|&|-|\/)\s+/i)[0]
    .trim();
}

const LOWER_WORDS = new Set(['de', 'la', 'van', 'von', 'del', 'di', 'da']);

/**
 * Clerks type surnames in caps (`Thomas H. KEAN, JR.`) and Union prefixes the
 * party. Display names are recased rather than retyped, so the name on screen
 * still traces to the certification.
 */
export function properName(raw) {
  let s = headOfTicket(String(raw ?? '').trim().replace(/^(DEM|REP|NON|GRN|LIB|CON|SOC)\s+/i, ''));
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
  return headOfTicket(String(name ?? ''))
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !NAME_SUFFIXES.has(w))
    .join(' ');
}
