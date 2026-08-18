# Polisof

A US Senate election intelligence terminal.

Every seat on the 2026 ballot, on one map: hover a state for the head-to-head,
click it for the full dossier, zoom in for counties and towns. Built for people
who need the county underneath the number.

```bash
npm install
npm run data     # build the static datasets (first run fetches sources)
npm run dev      # http://localhost:5173
```

---

## What it does

**Hover a state** → the matchup. Portrait, party, exact age, the office each
candidate held before this one, and cash on hand.

**Click a state** → the dossier. Which counties are actually in play and why,
which coalitions make up the electorate and how they moved, a path to victory
in net votes, market odds, outside spending, and links straight into the FEC,
the FCC political file and the ad libraries.

**Zoom into a state** → counties and towns. Sixteen switchable county layers —
partisan margin, swing, turnout, density, education, race, income, poverty,
migration and more. Click a county for its full census profile.

`⌘K` searches every seat, candidate and county in the country.

---

## The part worth reading

This product makes claims someone might act on, so it is built to be explicit
about how much weight each number can bear. Four kinds of figure appear, and
they are visually distinguishable everywhere:

| | What it is | Example |
|---|---|---|
| **Certified** | Official results, unmodified | County presidential margins, 2016–2024 |
| **On record** | Read from a primary record, not typed in | Age, party, office history, portraits |
| **Computed** | Derived in the open from the two above | Ratings, flip targets, coalitions, path to victory |
| **Live source** | No offline copy exists; renders as `—` plus a link | Cash on hand, polling, odds, ad buys, appearances |

**Nothing is fabricated to fill a gap.** A field that cannot be verified renders
as an em dash with the reason and the command that would fill it — never a
zero, never a plausible-looking placeholder. The provenance panel (`Sources` in
the header) states the vintage and licence of every dataset, plus the known
limits.

Three decisions worth calling out, because each one cost a feature:

- **Town population ships empty.** The obvious source geocodes by *name*, so
  every "Portland" in it carries Portland OR's coordinates — joining against it
  silently gives Concord NH the 123,764 residents of Concord CA. Towns ship
  with name, county and location only; `npm run sync:census` fills the rest
  from the Census API.
- **Which seats are up is derived, not declared.** A hand-maintained race list
  goes stale silently when a senator resigns or is appointed. The race list is
  read from the congressional record at build time, and where it disagrees with
  the hand-authored roster the record wins and the UI flags the drift.
- **Bioguide IDs are never hand-entered.** A wrong one does not fail loudly —
  it renders a different person's face. They are matched from name + state +
  chamber, and anything ambiguous is reported instead of guessed.

### Perishable by construction

Candidate fields are hand-authored from public reporting and **verified through
2026-05** — that is the one thing no dataset supplies. Primaries held after that
date are not reflected: where a field shows several candidates of one party, the
primary may already have resolved it. Edit `scripts/lib/roster.mjs` and re-run
`npm run data` to update.

### The baseline rating is a prior, not a forecast

`Polisof Baseline` is recent presidential lean (2024 weighted 65%, 2020 35%)
adjusted for incumbency — 3.5 points for an elected incumbent, 1.5 for an
appointee who has never faced the electorate, nothing for an open seat. It says
what a seat looks like *before anyone campaigns*. No polling, no fundraising, no
candidate quality. The arithmetic is in `src/lib/analysis.ts` and every input is
shown on screen next to the output.

---

## Live connectors

The four fields that cannot be seeded offline have working connectors. All keys
are free and optional.

```bash
npm run sync                    # everything available
npm run sync:census             # county + place demographics (keyless)
FEC_API_KEY=xxx npm run sync:fec        # cash on hand, outside spending
npm run sync:kalshi             # market odds (keyless)
META_AD_TOKEN=xxx npm run sync:ads      # creative-level political ads
```

| Key | Where | Fills |
|---|---|---|
| `FEC_API_KEY` | [api.data.gov/signup](https://api.data.gov/signup/) | Cash on hand, receipts, itemised independent expenditures |
| `CENSUS_API_KEY` | [census.gov](https://api.census.gov/data/key_signup.html) | Optional; raises the keyless daily cap |
| `META_AD_TOKEN` | [developers.facebook.com](https://developers.facebook.com/) | Ad creatives with spend and impression *bands* |

No connector ships for **polling** or **appearances**, and the UI says so rather
than pretending otherwise: the free polling aggregation feeds have been retired
and the rest are licensed, and campaign schedules are published as ad-hoc social
posts with no common feed. Both sections link to the authoritative source.

A connector that cannot verify a value writes `null`. None of them can leave the
app in a worse state than before.

---

## Data sources

| Dataset | Source | Licence |
|---|---|---|
| State & county boundaries | US Census cartographic boundaries via `us-atlas` | Public domain / ISC |
| County presidential results 2016–2024 | State election authorities & AP, compiled by [tonmcg](https://github.com/tonmcg/US_County_Level_Election_Results_08-24) | Open data |
| County demographics & economy | Census ACS 5-year & PEP, USDA ERS, BLS LAUS, FBI UCR | Public domain |
| Candidate identity & office history | [unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) | CC0 |
| Candidate portraits | [unitedstates/images](https://github.com/unitedstates/images) | Public domain (US government works) |
| Towns & cities | USGS GNIS / Census place files | Public domain |
| Challenger fields | Hand-authored — `scripts/lib/roster.mjs` | — |

Campaign photography is copyrighted and is not redistributed here; candidates
who never served in Congress render a generated monogram.

### Known limits

- **Alaska** certifies presidential results by state house district, not
  borough. Its boroughs carry no margin; the statewide total is reconciled from
  district returns. The source encodes this differently every cycle — including
  2024 codes that collide with real borough FIPS — so the ingest reconciles by
  value rather than trusting the scheme.
- Seeded census figures are **ACS 2014–2018** with 2018 population estimates.
  `npm run sync:census` re-derives them at the current vintage.
- The source's own `crime_rate_per_100000` column is corrupt (Fulton County GA
  reads 8.2 billion per 100k). Crime rates are recomputed from the underlying
  UCR counts and suppressed where agency reporting covers under 70% of a county.

---

## Architecture

```
scripts/
  build-data.mjs        orchestrates ingest in dependency order
  ingest/               geo · elections · census · places · candidates · photos
  connectors/           fec · census-acs · kalshi · ads
  lib/roster.mjs        the hand-authored candidate roster — the perishable part
src/
  lib/analysis.ts       ratings, flip targets, coalitions, path to victory
  lib/metrics.ts        the 16 county layers
  lib/palette.ts        the colour system
  components/           MapStage · HoverCard · Dossier · CountyPanel · …
public/data/            generated, committed, ~5.6 MB
```

Network fetches cache under `scripts/.cache`, so re-runs are offline. Delete it
to force a refresh.

### Colour

Partisan margin is the only **diverging** encoding — two poles, a true neutral
gray midpoint, seven equal steps per arm. Every other county layer is
**sequential**, one hue, so a dark red county is never mistaken for a Republican
one when the active layer is median income. Compositional charts use a fixed
**categorical** order validated for colour-vision deficiency on this surface
(worst adjacent pair ΔE 8.4 protanopia, 19.3 normal vision), deliberately
without a red slot so a demographic wedge never impersonates party identity.

The surface is dark, so intensity means partisanship: a landslide county glows,
a coin-flip county sinks into the plane. The national rating map inverts that on
purpose — there, a tossup is the loudest thing on screen, because finding the
seats in play is the entire job of that view.

---

## Scripts

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build |
| `npm run data` | Rebuild all static datasets |
| `npm run sync` | Run every live connector |

---

## Polisof · NJ-07

`nj07/` is a second, self-contained app built on the same design language and
the same rules about provenance, aimed at a single seat: New Jersey's 7th, the
most closely watched House race of the 2026 cycle.

It is not this app filtered down. A district is not a state — its unit is the
municipality, not the county, and its boundary is not something a shapefile can
settle on its own. So NJ-07's territory is **read out of the returns**: every
New Jersey precinct records the congressional district it voted in, all
twenty-one counties are read, and the 94 municipalities that appear on a CD-7
ballot are the district. Four of them straddle a district line and carry the
measured share of their vote that was cast on a NJ-07 ballot.

```bash
cd nj07 && npm install && npm run data && npm run dev
```

See `nj07/README.md` — particularly the joins that were not obvious, and the
map layer that is deliberately missing.
