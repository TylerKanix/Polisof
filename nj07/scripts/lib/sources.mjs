/**
 * Every external source this project reads, in one place, with the vintage
 * and licence the provenance panel shows the reader.
 *
 * Two hard constraints shaped this list. Certified New Jersey returns are not
 * published as data by the state — they are county-clerk PDFs — so the
 * transcription of record is OpenElections'. And the district's own boundary
 * is not taken from a map file at all: it is read out of the returns (see
 * `ingest/elections.mjs`), because a boundary file and a results file can
 * disagree, and when they do the returns are the thing that actually elected
 * someone.
 */

export const OPENELECTIONS = 'https://raw.githubusercontent.com/openelections/openelections-data-nj/master';

/** The 21 New Jersey counties, as OpenElections slugs them. */
export const NJ_COUNTIES = [
  'atlantic', 'bergen', 'burlington', 'camden', 'cape_may', 'cumberland',
  'essex', 'gloucester', 'hudson', 'hunterdon', 'mercer', 'middlesex',
  'monmouth', 'morris', 'ocean', 'passaic', 'salem', 'somerset', 'sussex',
  'union', 'warren',
];

/**
 * The general elections this build reads.
 *
 * 2020 and 2022 are absent on purpose. OpenElections has transcribed only
 * three of New Jersey's twenty-one counties for 2020 and none of the ones
 * NJ-07 sits in for 2022, and a partisan baseline computed from a third of a
 * district is worse than no baseline at all — it would look like a number.
 * Both cycles are listed in the provenance panel as known gaps.
 */
export const ELECTIONS = [
  {
    id: 'g2016',
    year: 2016,
    date: '2016-11-08',
    label: '2016 general',
    level: 'municipal',
    file: '2016/20161108__nj__general__municipal.csv',
  },
  {
    id: 'g2018',
    year: 2018,
    date: '2018-11-06',
    label: '2018 general',
    level: 'municipal',
    file: '2018/20181106__nj__general__municipal.csv',
  },
  {
    id: 'g2024',
    year: 2024,
    date: '2024-11-05',
    label: '2024 general',
    level: 'precinct',
    file: (county) => `2024/20241105__nj__general__${county}__precinct.csv`,
  },
];

export const BOUNDARIES = {
  url: 'https://raw.githubusercontent.com/njam-data/new-jersey-municipalities/main/data/new-jersey-municipalities.geojson',
  cache: 'nj-municipalities.geojson',
};

export const MANIFEST_SOURCES = [
  {
    id: 'openelections',
    label: 'Certified returns, by precinct and municipality',
    source: 'OpenElections (openelections-data-nj), transcribed from county clerk certifications',
    url: 'https://github.com/openelections/openelections-data-nj',
    license: 'Public domain (compiled from public records)',
    vintage: '2016, 2018 and 2024 general elections',
  },
  {
    id: 'boundaries',
    label: 'Municipal boundaries',
    source: 'NJ Office of GIS (NJGIN), via njam-data/new-jersey-municipalities',
    url: 'https://njogis-newjersey.opendata.arcgis.com/datasets/municipal-boundaries-of-nj-hosted-3857',
    license: 'NJGIN open data',
    vintage: 'Municipal Boundaries of NJ; population fields are Census 2010',
  },
  {
    id: 'roster',
    label: '2026 candidate roster',
    source: 'Hand-authored from public reporting; every entry carries its citation',
    url: null,
    license: 'n/a',
    vintage: 'see verifiedThrough in race.json',
  },
];
