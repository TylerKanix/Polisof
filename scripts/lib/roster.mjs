/**
 * The 2026 US Senate map: seats up, and the candidates contesting them.
 *
 * ── READ THIS BEFORE TRUSTING A NAME ──────────────────────────────────────
 * This roster is hand-authored from public reporting and is verified through
 * **2026-05** (`VERIFIED_THROUGH`). Primaries held after that date are NOT
 * reflected: where a field shows several candidates of one party, the primary
 * may already have resolved it. Candidate identity is the one thing here that
 * cannot be derived from a dataset — so it is the one thing typed by hand, and
 * it is the first thing to re-check.
 *
 * Everything downstream of a name IS derived, not typed:
 *   - age, birthday, party, and office history   -> congress-legislators
 *   - portraits                                   -> unitedstates/images
 *   - cash on hand                                -> FEC (npm run sync:fec)
 *   - county baselines, swing, coalitions         -> certified results + ACS
 *
 * `office` and `occupation` are only set for people who have never served in
 * Congress; for everyone else the office history is read off the primary
 * record so it cannot drift.
 *
 * status:
 *   incumbent  — currently holds the seat
 *   declared   — publicly running as of VERIFIED_THROUGH
 *   potential  — credibly reported as considering; not confirmed
 */

export const VERIFIED_THROUGH = '2026-05';
export const ELECTION_DAY = '2026-11-03';

const C = (name, party, status, extra = {}) => ({ name, party, status, ...extra });

/**
 * seatClass 2 seats are the regular Class II cycle. `special` seats are
 * appointments filling a vacancy that must face voters in 2026.
 */
export const RACES = [
  {
    state: 'AL', seatClass: 2, open: true,
    incumbent: 'Tommy Tuberville',
    openReason: 'Tuberville is running for Governor rather than re-election.',
    candidates: [
      C('Steve Marshall', 'R', 'declared', { office: 'Attorney General of Alabama' }),
      C('Barry Moore', 'R', 'declared'),
      C('Jared Hudson', 'R', 'declared', { occupation: 'Former Navy SEAL; nonprofit founder' }),
    ],
  },
  {
    state: 'AK', seatClass: 2, open: false,
    candidates: [
      C('Dan Sullivan', 'R', 'incumbent'),
      C('Mary Peltola', 'D', 'potential', {
        note: 'Reported as weighing a Senate bid after her 2024 House loss; not confirmed as of the verification date.',
      }),
    ],
  },
  {
    state: 'AR', seatClass: 2, open: false,
    candidates: [C('Tom Cotton', 'R', 'incumbent')],
  },
  {
    state: 'CO', seatClass: 2, open: false,
    candidates: [C('John Hickenlooper', 'D', 'incumbent')],
  },
  {
    state: 'DE', seatClass: 2, open: false,
    candidates: [C('Chris Coons', 'D', 'incumbent')],
  },
  {
    state: 'FL', seatClass: 1, open: false, special: true,
    specialReason:
      "Marco Rubio resigned to become Secretary of State; Ashley Moody was appointed and must face voters for the term's remainder.",
    candidates: [
      C('Ashley Moody', 'R', 'incumbent', {
        office: 'Attorney General of Florida (2019-2025); appointed US Senator 2025',
        occupation: 'Former circuit judge, Hillsborough County',
        appointed: true,
      }),
      C('Josh Weil', 'D', 'declared', { occupation: 'Public school teacher' }),
    ],
  },
  {
    state: 'GA', seatClass: 2, open: false,
    candidates: [
      C('Jon Ossoff', 'D', 'incumbent'),
      C('Buddy Carter', 'R', 'declared'),
      C('Mike Collins', 'R', 'declared'),
      C('Derek Dooley', 'R', 'declared', { occupation: 'Former college football head coach' }),
    ],
    note: 'Governor Brian Kemp declined to run, leaving an unsettled Republican field.',
  },
  {
    state: 'ID', seatClass: 2, open: false,
    candidates: [C('Jim Risch', 'R', 'incumbent')],
  },
  {
    state: 'IL', seatClass: 2, open: true,
    incumbent: 'Dick Durbin',
    openReason: 'Durbin is retiring after five terms.',
    candidates: [
      C('Juliana Stratton', 'D', 'declared', { office: 'Lieutenant Governor of Illinois' }),
      C('Raja Krishnamoorthi', 'D', 'declared'),
      C('Robin Kelly', 'D', 'declared'),
    ],
  },
  {
    state: 'IA', seatClass: 2, open: true,
    incumbent: 'Joni Ernst',
    openReason: 'Ernst announced she would not seek a third term.',
    candidates: [
      C('Ashley Hinson', 'R', 'declared'),
      C('Zach Wahls', 'D', 'declared', { office: 'Iowa State Senator' }),
      C('Josh Turek', 'D', 'declared', {
        office: 'Iowa State Representative',
        occupation: 'Paralympic gold medalist',
      }),
      C('Nathan Sage', 'D', 'declared', { occupation: 'Marine veteran; chamber of commerce director' }),
      C('Jackie Norris', 'D', 'declared', { occupation: 'Nonprofit executive; former Obama aide' }),
    ],
  },
  {
    state: 'KS', seatClass: 2, open: false,
    candidates: [C('Roger Marshall', 'R', 'incumbent')],
  },
  {
    state: 'KY', seatClass: 2, open: true,
    incumbent: 'Mitch McConnell',
    openReason: 'McConnell is retiring after seven terms and a record run as party leader.',
    candidates: [
      C('Nate Morris', 'R', 'declared', { occupation: 'Founder, waste and recycling company' }),
      C('Andy Barr', 'R', 'declared'),
      C('Pamela Stevenson', 'D', 'declared', {
        office: 'Kentucky State Representative',
        occupation: 'Retired Air Force colonel; attorney',
      }),
    ],
  },
  {
    state: 'LA', seatClass: 2, open: false,
    candidates: [
      C('Bill Cassidy', 'R', 'incumbent'),
      C('John Fleming', 'R', 'declared', { office: 'Louisiana State Treasurer' }),
      C('Blake Miguez', 'R', 'declared', { office: 'Louisiana State Senator' }),
    ],
    note: 'Louisiana replaced its all-party primary with closed party primaries for 2026, sharpening the challenge to Cassidy from his right.',
  },
  {
    state: 'ME', seatClass: 2, open: false,
    candidates: [
      C('Susan Collins', 'R', 'incumbent'),
      C('Janet Mills', 'D', 'declared', { office: 'Governor of Maine; former Maine Attorney General' }),
      C('Graham Platner', 'D', 'declared', { occupation: 'Oyster farmer; Marine and Army veteran' }),
      C('Jordan Wood', 'D', 'declared', { occupation: 'Former congressional chief of staff' }),
    ],
  },
  {
    state: 'MA', seatClass: 2, open: false,
    candidates: [
      C('Ed Markey', 'D', 'incumbent'),
      C('Seth Moulton', 'D', 'declared'),
    ],
  },
  {
    state: 'MI', seatClass: 2, open: true,
    incumbent: 'Gary Peters',
    openReason: 'Peters is retiring after two terms.',
    candidates: [
      C('Mallory McMorrow', 'D', 'declared', { office: 'Michigan State Senator' }),
      C('Abdul El-Sayed', 'D', 'declared', {
        office: 'Former Executive Director, Detroit Health Department',
        occupation: 'Physician and epidemiologist',
      }),
      C('Haley Stevens', 'D', 'declared'),
      C('Mike Rogers', 'R', 'declared'),
    ],
    note: 'Rogers lost the 2024 Senate race here by roughly 19,000 votes and is running again.',
  },
  {
    state: 'MN', seatClass: 2, open: true,
    incumbent: 'Tina Smith',
    openReason: 'Smith is retiring after filling and then winning the seat.',
    candidates: [
      C('Peggy Flanagan', 'D', 'declared', { office: 'Lieutenant Governor of Minnesota' }),
      C('Angie Craig', 'D', 'declared'),
      C('Royce White', 'R', 'declared', { occupation: 'Former professional basketball player' }),
    ],
  },
  {
    state: 'MS', seatClass: 2, open: false,
    candidates: [
      C('Cindy Hyde-Smith', 'R', 'incumbent'),
      C('Ty Pinkins', 'D', 'declared', { occupation: 'Army veteran; attorney' }),
    ],
  },
  {
    state: 'MT', seatClass: 2, open: false,
    candidates: [C('Steve Daines', 'R', 'incumbent')],
  },
  {
    state: 'NE', seatClass: 2, open: false,
    candidates: [
      C('Pete Ricketts', 'R', 'incumbent'),
      C('Dan Osborn', 'I', 'declared', {
        occupation: 'Industrial mechanic; former union president',
        note: 'Held Deb Fischer to a 6.7-point win as an independent in 2024, the closest Nebraska Senate race in decades.',
      }),
    ],
  },
  {
    state: 'NH', seatClass: 2, open: true,
    incumbent: 'Jeanne Shaheen',
    openReason: 'Shaheen is retiring after three terms.',
    candidates: [
      C('Chris Pappas', 'D', 'declared'),
      C('Scott Brown', 'R', 'declared', {
        office: 'US Senator for Massachusetts (2010-2013); US Ambassador to New Zealand',
      }),
    ],
  },
  {
    state: 'NJ', seatClass: 2, open: false,
    candidates: [C('Cory Booker', 'D', 'incumbent')],
  },
  {
    state: 'NM', seatClass: 2, open: false,
    candidates: [C('Ben Ray Lujan', 'D', 'incumbent')],
  },
  {
    state: 'NC', seatClass: 2, open: true,
    incumbent: 'Thom Tillis',
    openReason:
      'Tillis announced he would not seek a third term after breaking with the president over the 2025 tax-and-spending bill.',
    candidates: [
      C('Roy Cooper', 'D', 'declared', {
        office: 'Governor of North Carolina (2017-2025); NC Attorney General (2001-2017)',
      }),
      C('Michael Whatley', 'R', 'declared', {
        office: 'Chair, Republican National Committee; former NC GOP chair',
      }),
    ],
  },
  {
    state: 'OH', seatClass: 3, open: false, special: true,
    specialReason:
      'JD Vance resigned on becoming Vice President; Jon Husted was appointed and must face voters for the remainder of the term.',
    candidates: [
      C('Jon Husted', 'R', 'incumbent', {
        office: 'Lieutenant Governor of Ohio (2019-2025); Ohio Secretary of State',
        appointed: true,
      }),
      C('Sherrod Brown', 'D', 'declared', {
        note: 'Held this class of seat for three terms before losing in 2024; running for the seat he did not lose.',
      }),
    ],
  },
  {
    state: 'OK', seatClass: 2, open: false,
    fieldUnverified:
      'This seat changed hands after the verification date — it is now held by an appointee. ' +
      'No challenger field has been verified; the incumbent shown is read from the congressional record.',
    candidates: [],
  },
  {
    state: 'OR', seatClass: 2, open: false,
    candidates: [C('Jeff Merkley', 'D', 'incumbent')],
  },
  {
    state: 'RI', seatClass: 2, open: false,
    candidates: [C('Jack Reed', 'D', 'incumbent')],
  },
  {
    state: 'SC', seatClass: 2, open: false,
    fieldUnverified:
      'This seat changed hands after the verification date — it is now held by an appointee. ' +
      'The challengers below were declared before that change and may no longer be running.',
    candidates: [
      C('Andre Bauer', 'R', 'declared', { office: 'Lieutenant Governor of South Carolina (2003-2011)' }),
      C('Annie Andrews', 'D', 'declared', { occupation: 'Pediatrician' }),
    ],
  },
  {
    state: 'SD', seatClass: 2, open: false,
    candidates: [C('Mike Rounds', 'R', 'incumbent')],
  },
  {
    state: 'TN', seatClass: 2, open: false,
    candidates: [C('Bill Hagerty', 'R', 'incumbent')],
  },
  {
    state: 'TX', seatClass: 2, open: false,
    candidates: [
      C('John Cornyn', 'R', 'incumbent'),
      C('Ken Paxton', 'R', 'declared', { office: 'Attorney General of Texas' }),
      C('Wesley Hunt', 'R', 'declared'),
      C('Colin Allred', 'D', 'declared', {
        note: 'Lost the 2024 Senate race to Ted Cruz by 8.5 points; running again.',
      }),
      C('James Talarico', 'D', 'declared', { office: 'Texas State Representative' }),
    ],
    note: 'The marquee primary of the cycle: an incumbent facing the state attorney general and a sitting congressman.',
  },
  {
    state: 'VA', seatClass: 2, open: false,
    candidates: [C('Mark Warner', 'D', 'incumbent')],
  },
  {
    state: 'WV', seatClass: 2, open: false,
    candidates: [C('Shelley Moore Capito', 'R', 'incumbent')],
  },
  {
    state: 'WY', seatClass: 2, open: false,
    candidates: [C('Cynthia Lummis', 'R', 'incumbent')],
  },
];

/**
 * Former members of Congress on the 2026 ballot. Named here so the ingest
 * pulls them out of the (large) historical file; identity still resolves by
 * name + state, never by a hand-typed Bioguide ID.
 */
export const FORMER_MEMBERS = [
  { name: 'Mary Peltola', state: 'AK', type: 'rep' },
  { name: 'Scott Brown', state: 'MA', type: 'sen' },
  { name: 'Mike Rogers', state: 'MI', type: 'rep' },
  { name: 'Sherrod Brown', state: 'OH', type: 'sen' },
  { name: 'Colin Allred', state: 'TX', type: 'rep' },
  { name: 'John Fleming', state: 'LA', type: 'rep' },
];
