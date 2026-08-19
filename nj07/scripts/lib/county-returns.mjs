/**
 * Certified returns transcribed from county-clerk PDFs.
 *
 * Some races have no municipal transcription anywhere this build can reach,
 * but the counties themselves publish certified PDFs. Where one of those has
 * been read, its figures live here — at the resolution the document actually
 * provides, which for a county Statement of Vote is the county, not the town.
 *
 * That resolution is the whole point of keeping these separate from
 * `district.json`'s municipal data. A county total cannot be drawn on a map of
 * municipalities and must not be mixed into a district figure that is a sum of
 * towns. It is shown as what it is: one county's certified result, with the
 * share of the district that county represents stated next to it.
 *
 * Every figure carries its ballot-mode breakdown, which is not decoration —
 * it is a checksum. The modes must sum to the candidate's total and the
 * candidates must sum to the contest total, and `npm run audit` enforces both,
 * so a mistyped digit fails the build rather than shipping.
 */

export const COUNTY_RETURNS = [
  {
    county: 'Hunterdon',
    election: 'g2025',
    date: '2025-11-04',
    office: 'governor',
    label: '2025 Governor',
    /** Modes as the clerk files them, in the report's own column order. */
    modes: ['electionDay', 'early', 'mail', 'provisional'],
    contestTotal: 66839,
    candidates: [
      { name: 'Mikie Sherrill', party: 'D', total: 31663, byMode: [13743, 7929, 9650, 341] },
      { name: 'Jack Ciattarelli', party: 'R', total: 34683, byMode: [21314, 9027, 4173, 169] },
      { name: 'Vic Kaplan', party: 'I', total: 285, byMode: [166, 49, 68, 2] },
      { name: 'Joanne S. Kuniansky', party: 'S', total: 116, byMode: [55, 13, 47, 1] },
      { name: 'Write-in', party: null, total: 92, byMode: [51, 12, 29, 0] },
    ],
    source: {
      title: 'G25 OFFICIAL SOV — 2025 Hunterdon County General Election',
      publisher: 'Hunterdon County Clerk',
      certified: '2025-11-18',
      note: 'Summary Results Report. County totals only — the document carries no municipal breakdown of the governor’s race.',
    },
  },
  {
    county: 'Warren',
    election: 'g2025',
    date: '2025-11-04',
    office: 'governor',
    label: '2025 Governor',
    // Warren orders its columns differently from Hunterdon, which is exactly
    // why each return carries its own mode list rather than a shared one.
    modes: ['electionDay', 'mail', 'provisional', 'early'],
    contestTotal: 45579,
    /** The clerk also reports the ballots that recorded no valid vote. */
    overvotes: 46,
    undervotes: 175,
    candidates: [
      { name: 'Jack Ciattarelli', party: 'R', total: 25980, byMode: [16332, 2696, 177, 6775] },
      { name: 'Mikie Sherrill', party: 'D', total: 19199, byMode: [9169, 5209, 315, 4506] },
      { name: 'Vic Kaplan', party: 'I', total: 224, byMode: [146, 35, 5, 38] },
      { name: 'Joanne S. Kuniansky', party: 'S', total: 102, byMode: [76, 12, 2, 12] },
      { name: 'Write-in', party: null, total: 74, byMode: [40, 25, 0, 9] },
    ],
    source: {
      title: 'Official Summary Results Report — Warren County 2025 General Election',
      publisher: 'Warren County Clerk',
      certified: '2025-11-17',
      note: 'County summary. No municipal breakdown of the governor’s race in this document.',
    },
  },
  {
    county: 'Hunterdon',
    election: 'g2022',
    date: '2022-11-08',
    office: 'ushouse',
    district: 7,
    label: '2022 U.S. House',
    modes: ['electionDay', 'early', 'mail', 'provisional'],
    contestTotal: 60425,
    candidates: [
      { name: 'Thomas H. Kean Jr.', party: 'R', total: 32678, byMode: [25920, 2396, 4098, 264] },
      { name: 'Tom Malinowski', party: 'D', total: 27657, byMode: [14855, 3436, 8968, 398] },
      { name: 'Write-in', party: null, total: 90, byMode: [63, 11, 16, 0] },
    ],
    source: {
      title: 'G2022 Official SOV — Hunterdon County 2022 General Election',
      publisher: 'Hunterdon County Clerk',
      certified: '2022-12',
      note: 'Summary Results Report. County totals only.',
    },
  },
];

/**
 * The June 2026 primary, as certified by one county.
 *
 * The roster carries the statewide shares as *reported*; this is the only part
 * of that race read from a certification. It is one county of six, so it is
 * labelled as Hunterdon's result and never as the district's.
 */
export const PRIMARY_2026 = {
  county: 'Hunterdon',
  date: '2026-06-02',
  party: 'D',
  office: 'ushouse',
  district: 7,
  /** Ballots that included this contest, blanks and all. */
  contestTotal: 11859,
  candidates: [
    { name: 'Rebecca Bennett', votes: 5444 },
    { name: 'Brian Varela', votes: 2476 },
    { name: 'Michael Roth', votes: 2083 },
    { name: 'Tina Shah', votes: 1487 },
    { name: 'Write-in', votes: 22 },
  ],
  source: {
    title: 'P26 OFFICIAL SOV — June 2, 2026 Primary, Hunterdon County',
    publisher: 'Hunterdon County Clerk',
    certified: '2026-06-11',
    note:
      'Summed from the report’s per-district table across all 26 municipalities. ' +
      'The candidate columns never exceed the contest-total column in any of the ' +
      '117 precinct rows, which is what establishes the columns are read in the ' +
      'right order; the gap between them is undervotes.',
  },
};

/**
 * Municipal-level files that would close the remaining gaps, named exactly.
 *
 * None of these hosts is reachable from this build — every county site and
 * nj.gov answers nothing through the network policy — so they are listed for a
 * human to fetch rather than fetched. Each one, dropped into scripts/.cache as
 * a municipal CSV, turns a gap into a layer.
 */
export const WANTED = [
  {
    what: '2022 U.S. House in NJ-07, every municipality, in one file',
    url: 'https://www.nj.gov/state/elections/assets/pdf/election-results/2022/2022-general-election-results-hor-07.pdf',
    unlocks: 'The Kean–Malinowski race, the first fought on these lines, at full district coverage.',
  },
  {
    what: '2025 Governor by municipality — one file per county',
    url: 'https://www.nj.gov/state/elections/assets/pdf/election-results/2025/2025-official-general-results-governor-{county}.pdf',
    unlocks:
      'The 2025 map layer. Hunterdon and Warren are in at county level; the four still ' +
      'missing are sussex, somerset, union and morris — and all six are needed at ' +
      '*municipal* resolution, which the county summaries do not carry. Morris publishes ' +
      'exactly that at morriscountyclerk.org/…/2025-general-municipality-report-official-111725.pdf',
  },
];

/**
 * Checks run against an official county certification, and what they returned.
 *
 * This project's returns come from OpenElections, a volunteer transcription of
 * county paperwork. That is a dependency worth testing rather than trusting,
 * and Hunterdon's own by-district PDF makes it testable: every presidential,
 * Senate and House figure for all 26 of its municipalities, against the county
 * clerk's certified report.
 */
export const VERIFICATIONS = [
  {
    id: 'hunterdon-2024',
    what: 'Every 2024 municipal figure for Hunterdon — president, U.S. Senate and U.S. House',
    against: 'OFFICIAL RESULTS G2024 BY DISTRICT, Hunterdon County Clerk (certified 2025-02-03)',
    figuresChecked: 156,
    differences: 0,
    note:
      'All 26 municipalities, both major parties, three offices. The transcription this ' +
      'build depends on reproduces the county’s own certification exactly.',
  },
];
