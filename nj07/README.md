# Polisof · NJ-07

An election intelligence terminal for one seat: New Jersey's 7th congressional
district, the Kean–Bennett race, and the 94 municipalities that decide it.

```bash
npm install
npm run data     # build the static datasets (first run fetches sources)
npm run dev      # http://localhost:5173
```

Node 18 or newer — the ingest scripts use the built-in `fetch`. Everything
runs on your machine: there is no build service, no API key, and nothing to
deploy. `npm run data` is the only step that touches the network, and only the
first time; sources cache under `scripts/.cache`, so every later run is
offline.

`npm run standalone` produces a single 1.2 MB HTML file with every dataset
inlined — it opens from `file://` with no network at all.

---

## What it does

**Hover a town** → its 2024 House and presidential margins, turnout, and how
far the incumbent ran ahead of his own ticket there.

**Click a town** → every certified race back to 2016, the ballots behind each
one, how the county filed them, and whether the town was even in this district
two cycles ago.

**Eleven map layers** — partisan margin in four races, the 2016→2024 swing,
Kean's margin against Trump's in the same town, net votes supplied to the
district's margin, turnout, ballots cast, density, and the district's 2018
territory.

`⌘K` searches all 94 municipalities and every layer.

---

## The district is derived, not declared

Most district maps start from a shapefile. This one starts from the returns.

Every New Jersey precinct record carries the congressional district that
precinct voted in. So the build reads **all twenty-one counties**, finds every
precinct that appears on a CD-7 ballot, and the municipalities behind those
precincts *are* the district. No county list and no town list is maintained by
hand anywhere in this repo.

That buys two things a shapefile does not:

- **Split towns are measured, not assumed.** Four municipalities straddle a
  district line — Bridgewater (94.8% NJ-07), Mendham Township (85.1%), Linden
  (34.9%), Hillsborough (8.6%). Those shares are the share of each town's House
  vote actually cast on a NJ-07 ballot, and they are what the district totals
  prorate by.
- **A vote cannot go missing quietly.** If a row carrying CD-7 House votes
  cannot be matched to a municipality, the build throws. A district that comes
  out short fails loudly instead of rendering as a slightly smaller map.

Split towns also cast ballots in a *different* House race, with different
candidates. Those are kept in their own bucket and shown separately — pooling
them would invent a contest nobody ran in.

---

## The part worth reading

Four kinds of figure appear, and they are distinguishable everywhere:

| | What it is | Where |
|---|---|---|
| **Certified** | Transcribed from a county clerk certification, unmodified | Every margin, vote count and turnout figure |
| **Derived** | Computed in the open from certified totals | Swing, ticket-splitting, net contribution, district membership |
| **Estimated** | Certified totals scaled by a measured share | Split towns inside district-wide presidential and Senate rows |
| **Hand-authored** | Typed from public reporting, with a citation | The 2026 candidate roster, and nothing else |

**Nothing is fabricated to fill a gap.** Campaign finance, ad buys and polling
have no offline source here, so they render as an em dash plus the link that
would answer the question — never a zero.

### Three joins that were not obvious

**Clerks do not spell their own towns the same way twice.** The same
municipality is filed as `Alexandria Twp`, `Alexandria Township`, `Alexandria`
and `Township of Alexandria`, depending on the county and the page. Names are
matched on **letters, not words**, because the spaces move: Hunterdon writes
`Highbridge` for High Bridge, and Somerset writes `Bernards ville` for
Bernardsville — which is word-for-word indistinguishable from Bernards
Township, sitting next door, and would have silently absorbed 3,754 of its
neighbour's votes. Where two towns share a whole name — Hunterdon has a Clinton
Town beside a Clinton Township — the type word must settle it, and an unsettled
tie is reported rather than guessed at.

**Half the counties leave the party column empty.** Morris and Sussex file
`Thomas H. KEAN, JR.` with no party at all. Settling a candidate's party
town-by-town would have left a third of the district with no two-party margin —
and it did, until the map showed it. Identity and party are settled **once per
race** from every county's evidence, then applied everywhere.

**Union County files provisional ballots under two-letter codes.** `WE W2
Provisional Ballots` is Westfield Ward 2; `RO` and `RP` are Roselle and Roselle
Park. The scheme is "first two letters, unless that collides, then initials",
which is not a rule worth trusting blind — so it is *solved*: each town
proposes the codes it could own, and constraint propagation assigns the ones
only one town can hold until nothing is left to deduce. All 21 codes resolve, or
the build says which did not.

Clerk misspellings (`Finden` for Linden, `Bemardsville` for Bernardsville, a
2018 file that substitutes F for L throughout) are corrected only when the town
it would name is otherwise absent from that office's section of that file and
exactly one town is close enough. Every correction that fires is listed in the
provenance panel; there are 33.

### There is deliberately no vote-by-mail layer

It is the obvious layer to build from this data and it would be a lie. Hunterdon
files mail ballots as separate rows (21.6% of its presidential vote); Warren,
Sussex, Somerset and Morris fold every ballot into the district totals. A
mail-share choropleth would draw a 22-point cliff at the county line that is
paperwork, not behaviour. The filing table in the provenance panel carries it
instead, and each town's panel says what its own county does.

### What is missing, and why

- **2020 and 2022.** OpenElections has transcribed 3 of 21 New Jersey counties
  for 2020 and none of this district's for 2022 — which means the 0.8-point
  Kean/Malinowski race, the first fought on these lines, is absent. A partisan
  baseline built from part of a district would read as a fact rather than a
  fragment, so neither cycle is shipped.
- **Current demographics.** Population and density are the Census 2010 counts
  carried in the state boundary file. Current ACS estimates need
  `api.census.gov`, which this build environment cannot reach.
- **404 NJ-07 ballots** are filed by counties at county level — overseas and
  federal voters, attached to no municipality by construction. District totals
  are the sum of municipalities and exclude them, which is why the topline sits
  0.09% under the statewide certification. They are counted in the provenance
  panel rather than folded into a town that did not cast them.

### The roster is perishable

Candidate data is hand-authored from public reporting and **verified through
2026-08**, stamped in the header rather than buried. Anything after that — a
withdrawal, a by-petition candidate qualifying, a change in the incumbent's
status — is not reflected and will not announce itself. Edit
`scripts/lib/roster.mjs` and re-run `npm run data`.

---

## Data

`npm run data` runs three steps in dependency order. Sources are cached under
`scripts/.cache`, so re-runs are offline.

| File | What |
|---|---|
| `district.json` | 94 municipalities, every race, turnout, vote modes, membership evidence, corrections |
| `geo/munis.json` | Municipal boundaries as TopoJSON, 141 KB |
| `geo/frame.json` | Projection framing and the simplification audit |
| `race.json` | The 2026 roster, with citations |
| `manifest.json` | Source provenance |

Geometry is simplified **through a shared topology**, so neighbouring towns keep
the same border instead of opening hairline gaps. The build refuses any
simplification that moves a single town's area by more than 2%; at the shipped
settings the district's total area is preserved to 99.996%.

### Sources

- **Certified returns** — [OpenElections](https://github.com/openelections/openelections-data-nj),
  transcribed from county clerk certifications. 2016, 2018 and 2024 generals.
- **Municipal boundaries** — NJ Office of GIS (NJGIN), via
  [njam-data/new-jersey-municipalities](https://github.com/njam-data/new-jersey-municipalities).
- **The 2026 race** — public reporting, cited per claim in `scripts/lib/roster.mjs`.

---

## Layout

```
scripts/
  lib/munis.mjs       name resolution — the letters-not-words matcher
  lib/offices.mjs     office, party and candidate-identity normalisation
  lib/roster.mjs      the hand-authored 2026 race
  lib/sources.mjs     every external source, in one place
  ingest/elections.mjs  reads 21 counties, derives the district
  ingest/geo.mjs        boundaries, simplified and audited
src/
  lib/analysis.ts     derived measures; positive is Republican throughout
  lib/metrics.ts      the map layers, and the one that is missing on purpose
  components/         map, rail, town dossier, district dossier, provenance
```
