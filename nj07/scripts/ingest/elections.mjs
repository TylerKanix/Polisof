/**
 * Certified returns for New Jersey's 7th, by municipality.
 *
 * The district's territory is *derived*, not declared. Every one of New
 * Jersey's twenty-one counties is read, each precinct's House row carries the
 * congressional district it voted in, and the municipalities that appear on a
 * CD-7 ballot are the district. No county list and no town list is
 * hand-maintained anywhere in this file, so a boundary that moves shows up as
 * a changed build rather than as a stale constant.
 *
 * Three municipalities are split between districts. They are kept, marked
 * `split`, and carry the share of their 2024 House vote that was cast on a
 * CD-7 ballot — because presidential results exist only for the whole town,
 * and a split town's presidential margin is not the district's.
 *
 * Emits district.json.
 */
import { fetchCached, csvToObjects, writeJSON, num, round, log } from '../lib/util.mjs';
import { indexFromBoundaries, isTotalRow, voteMode, rescueMisspelling } from '../lib/munis.mjs';
import {
  readOffice,
  readParty,
  properName,
  isWriteIn,
  candidateKey,
  isAdministrative,
} from '../lib/offices.mjs';
import { OPENELECTIONS, NJ_COUNTIES, ELECTIONS, BOUNDARIES } from '../lib/sources.mjs';

const DISTRICT = '7';
const MODES = ['machine', 'mail', 'early', 'provisional', 'overseas'];

const url = (rel) => `${OPENELECTIONS}/${rel}`;
const cacheName = (rel) => rel.replace(/\//g, '__');

/** votes accumulator: office → party → {name, votes, byMode} */
const newBucket = () => ({ cands: new Map(), total: 0, byMode: zeroModes(), cd: null });
const zeroModes = () => Object.fromEntries(MODES.map((m) => [m, 0]));

function addVote(bucket, party, name, votes, mode) {
  bucket.total += votes;
  bucket.byMode[mode] += votes;
  const key = candidateKey(name) || name;
  if (!bucket.cands.has(key)) {
    bucket.cands.set(key, {
      key,
      names: new Map(),
      parties: new Map(),
      votes: 0,
      byMode: zeroModes(),
    });
  }
  const c = bucket.cands.get(key);
  c.names.set(name, (c.names.get(name) ?? 0) + 1);
  if (party) c.parties.set(party, (c.parties.get(party) ?? 0) + votes);
  c.votes += votes;
  c.byMode[mode] += votes;
}

/**
 * Settle on one spelling and one party for a candidate.
 *
 * Crucially this is decided **race-wide, not town-by-town**. Morris and Sussex
 * leave the party column empty on every row they file, so a candidate settled
 * inside one of those towns would come out partyless — and a partyless
 * candidate has no margin, which would have drawn a third of this district as
 * "no data" while the district totals looked fine. The evidence from every
 * county that did fill the column decides the party for all of them.
 *
 * Two different parties for one candidate is a contradiction between sources
 * rather than something to average, so it is flagged and carried.
 */
function settleCandidate(local, race) {
  const names = race?.names ?? local.names;
  // `I` is what a slogan resolves to when it names no party, so a county that
  // prints "Green Party" is better evidence than one that prints a slogan,
  // however many votes the second one carries. Specific letters outrank it.
  const parties = [...(race?.parties ?? local.parties)].sort(
    (a, b) => (a[0] === 'I' ? 1 : 0) - (b[0] === 'I' ? 1 : 0) || b[1] - a[1],
  );
  const name = [...names].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
  return {
    name,
    party: parties.length ? parties[0][0] : null,
    partyConflict: parties.length > 1 ? parties.map(([p]) => p) : undefined,
    votes: local.votes,
    byMode: local.byMode,
  };
}

/**
 * Pool every municipality's rows for a race, so identity and party are settled
 * once from all the evidence rather than once per town.
 */
function raceRegistry(store) {
  const registry = new Map();
  for (const byElection of store.values()) {
    for (const [electionId, byOffice] of byElection) {
      for (const [office, bucket] of byOffice) {
        if (office === 'registered' || office === 'ballots') continue;
        const key = `${electionId}/${office}`;
        let race = registry.get(key);
        if (!race) registry.set(key, (race = new Map()));
        for (const [candKey, c] of bucket.cands) {
          let g = race.get(candKey);
          if (!g) race.set(candKey, (g = { names: new Map(), parties: new Map() }));
          for (const [n, count] of c.names) g.names.set(n, (g.names.get(n) ?? 0) + count);
          for (const [p, v] of c.parties) g.parties.set(p, (g.parties.get(p) ?? 0) + v);
        }
      }
    }
  }
  return registry;
}

export async function run() {
  // The boundary file is what says which municipalities exist, so it is
  // fetched here rather than assumed to be on disk — geo.mjs runs after this
  // step and cannot be the one to put it there.
  const geo = JSON.parse(await fetchCached(BOUNDARIES.url, BOUNDARIES.cache));
  const index = indexFromBoundaries(geo.features);
  log('elections', `${index.all().length} municipalities in the boundary file`);

  /** geoid → { election → office → bucket } */
  const store = new Map();
  /** geoid → Map(cd → house votes), the evidence for district membership. */
  const houseByMuni = new Map();
  /** Rows that are real returns but belong to no municipality. */
  const unassigned = [];
  const unresolved = new Map();
  const codeReports = [];
  const corrections = [];
  const dropped = new Map();

  const bucketFor = (geoid, election, office) => {
    if (!store.has(geoid)) store.set(geoid, new Map());
    const byElection = store.get(geoid);
    if (!byElection.has(election)) byElection.set(election, new Map());
    const byOffice = byElection.get(election);
    if (!byOffice.has(office)) byOffice.set(office, newBucket());
    return byOffice.get(office);
  };

  for (const election of ELECTIONS) {
    const files =
      election.level === 'precinct'
        ? NJ_COUNTIES.map((c) => ({ county: c, rel: election.file(c) }))
        : [{ county: null, rel: election.file }];

    for (const { county, rel } of files) {
      let text;
      try {
        text = await fetchCached(url(rel), cacheName(rel));
      } catch (err) {
        log('elections', `WARN ${rel} unavailable — ${err.message}`);
        continue;
      }
      const rows = csvToObjects(text);
      const placeCol = election.level === 'precinct' ? 'precinct' : 'municipality';

      // Teach the index this county's abbreviation codes before resolving, so
      // provisional and overseas rows land in the right town.
      if (county) {
        const observed = new Set();
        for (const r of rows) {
          const place = r[placeCol];
          if (!place || isTotalRow(place)) continue;
          if (index.resolve(county, place).ok) continue;
          const first = place.trim().split(/\s+/)[0].toLowerCase();
          if (/^[a-z]{2,4}$/.test(first)) observed.add(first);
        }
        if (observed.size) {
          const stuck = index.learnCodes(county, observed);
          codeReports.push({
            county,
            resolved: observed.size - stuck.length,
            unresolved: stuck,
          });
        }
      }

      /**
       * These files are organised by office, and each office section uses its
       * own spelling convention — the 2016 presidential pages say `Clinton
       * Town` and `Clinton Township`, the House pages that follow say `Clinton
       * Twp` and, for the other one, just `Clinton`. Resolution is therefore
       * scoped to a (county, office) section: within one section every
       * municipality appears at most once, which is what makes a bare
       * `Clinton` decidable — the Township is already spoken for, so the bare
       * row is the Town. The same scope is what lets a misspelling be
       * corrected safely.
       */
      const scopeKey = (rowCounty, office) => `${rowCounty}|${office}`;
      const claimed = new Map();
      for (const r of rows) {
        const place = r[placeCol];
        if (!place || isTotalRow(place)) continue;
        const { office } = readOffice(r.office, r.district);
        if (!office) continue;
        const hit = index.resolve(county ?? r.county, place);
        if (!hit.ok) continue;
        const key = scopeKey(county ?? r.county, office);
        if (!claimed.has(key)) claimed.set(key, new Set());
        claimed.get(key).add(hit.muni.geoid);
      }

      const settled = new Map();
      const settle = (rowCounty, office, place, hit) => {
        const memo = `${rowCounty}|${office}|${place}`;
        if (settled.has(memo)) return settled.get(memo);
        const seen = claimed.get(scopeKey(rowCounty, office)) ?? new Set();
        let muni = null;
        let how = null;
        if (hit.reason === 'ambiguous') {
          const left = hit.candidateMunis.filter((m) => !seen.has(m.geoid));
          if (left.length === 1) {
            muni = left[0];
            how = 'section';
          }
        } else {
          muni = rescueMisspelling(index, rowCounty, place, seen);
          if (muni) how = 'spelling';
        }
        if (muni) {
          corrections.push({
            election: election.id,
            county: rowCounty,
            wrote: place,
            read: muni.name,
            how,
          });
        }
        settled.set(memo, muni);
        return muni;
      };

      for (const r of rows) {
        const place = r[placeCol];
        if (!place || isTotalRow(place)) continue;
        const votes = num(r.votes);
        if (votes === null) continue;

        const { office, district } = readOffice(r.office, r.district);
        if (!office) continue;

        const rowCounty = county ?? r.county;
        let hit = index.resolve(rowCounty, place);
        if (!hit.ok) {
          const muni = settle(rowCounty, office, place, hit);
          if (muni) hit = { ok: true, muni, corrected: true };
        }
        if (!hit.ok) {
          // County-wide federal/overseas ballot rows belong to no town. They
          // are kept at district level when they name CD-7, and reported
          // either way rather than quietly dropped.
          if (votes > 0) {
            unassigned.push({
              election: election.id,
              county: rowCounty,
              place,
              office,
              district,
              party: readParty(r.party, r.candidate),
              candidate: properName(r.candidate),
              votes,
              reason: hit.reason,
            });
            const k = `${rowCounty}|${place}|${hit.reason}`;
            unresolved.set(k, (unresolved.get(k) ?? 0) + votes);
          }
          continue;
        }

        const geoid = hit.muni.geoid;
        const mode = election.level === 'precinct' ? voteMode(place) : 'machine';

        if (office === 'registered' || office === 'ballots') {
          const b = bucketFor(geoid, election.id, office);
          b.total += votes;
          b.byMode[mode] += votes;
          continue;
        }

        if (office === 'ushouse' && district) {
          if (!houseByMuni.has(geoid)) houseByMuni.set(geoid, new Map());
          const h = houseByMuni.get(geoid);
          const key = `${election.id}:${district}`;
          h.set(key, (h.get(key) ?? 0) + votes);
        }

        // Ballot accounting is not a candidate. Dropped before it can reach a
        // bucket, because inside one it would inflate the total and quietly
        // deflate every real candidate's share.
        if (isAdministrative(r.candidate)) {
          const k = `${rowCounty} · ${String(r.candidate).trim()}`;
          dropped.set(k, (dropped.get(k) ?? 0) + votes);
          continue;
        }

        const name = properName(r.candidate);
        if (!name) continue;
        const party = isWriteIn(name) ? null : readParty(r.party, r.candidate);
        // A split town casts ballots in two different House races. They are
        // separate contests with separate candidates, so they get separate
        // buckets — pooling them would invent a race nobody ran in.
        const officeKey = office === 'ushouse' ? `ushouse:${district ?? 'unknown'}` : office;
        const b = bucketFor(geoid, election.id, officeKey);
        if (office === 'ushouse') b.cd = district ?? b.cd;
        addVote(b, party, name, votes, mode);
      }
      log('elections', `${election.id}${county ? ` ${county}` : ''}: ${rows.length} rows`);
    }
  }

  // A CD-7 vote that reaches no municipality would quietly shrink the
  // district, so it stops the build. The exception is the county-wide
  // federal-ballot lines — `7TH CD STATE/FED`, `Federal President` — which
  // belong to no town by construction and are carried separately.
  const COUNTY_LEVEL = /\bcd\b|congressional|federal|removed resident|overseas/i;
  const stray = unassigned.filter(
    (u) => u.office === 'ushouse' && u.district === DISTRICT && !COUNTY_LEVEL.test(u.place),
  );
  if (stray.length) {
    const worst = stray.sort((a, b) => b.votes - a.votes).slice(0, 8);
    throw new Error(
      `${stray.length} rows carry CD-${DISTRICT} House votes but match no municipality — ` +
        'the district would be built short. Fix the resolver before shipping:\n' +
        worst.map((u) => `  ${u.county} · ${u.place} · ${u.votes} votes`).join('\n'),
    );
  }

  // ---- Membership, read out of the 2024 House returns -----------------------
  const members = [];
  for (const [geoid, byKey] of houseByMuni) {
    const cds = new Map();
    for (const [key, votes] of byKey) {
      const [election, cd] = key.split(':');
      if (election !== 'g2024') continue;
      cds.set(cd, (cds.get(cd) ?? 0) + votes);
    }
    if (!cds.has(DISTRICT)) continue;
    const total = [...cds.values()].reduce((a, b) => a + b, 0);
    const share = cds.get(DISTRICT) / total;
    members.push({
      geoid,
      share,
      others: [...cds]
        .filter(([cd]) => cd !== DISTRICT)
        .map(([cd, v]) => ({ cd: Number(cd), share: round(v / total, 4) }))
        .sort((a, b) => b.share - a.share),
    });
  }
  log(
    'elections',
    `district ${DISTRICT}: ${members.length} municipalities, ` +
      `${members.filter((m) => m.share < 0.999).length} split with another district`,
  );

  // ---- Emit -----------------------------------------------------------------
  const registry = raceRegistry(store);

  const municipalities = members
    .map(({ geoid, share, others }) => {
      const muni = index.get(geoid);
      const byElection = store.get(geoid) ?? new Map();
      const results = {};
      for (const [electionId, byOffice] of byElection) {
        // Of a split town's two House races, the one this app is about is the
        // primary; the other is kept under its own key so the panel can show
        // it rather than pretend the town only voted once.
        const houseKeys = [...byOffice.keys()].filter((k) => k.startsWith('ushouse:'));
        const primaryHouse =
          houseKeys.find((k) => k === `ushouse:${DISTRICT}`) ??
          houseKeys.sort((a, b) => byOffice.get(b).total - byOffice.get(a).total)[0];

        for (const [office, bucket] of byOffice) {
          if (office === 'registered' || office === 'ballots') continue;
          const race = registry.get(`${electionId}/${office}`);
          const cands = [...bucket.cands.entries()]
            .map(([candKey, c]) => settleCandidate(c, race?.get(candKey)))
            .sort((a, b) => b.votes - a.votes)
            .map((c) => ({
              name: c.name,
              party: c.party,
              ...(c.partyConflict ? { partyConflict: c.partyConflict } : {}),
              votes: c.votes,
              byMode: compactModes(c.byMode),
            }));
          const key = office.startsWith('ushouse:')
            ? office === primaryHouse
              ? 'ushouse'
              : `ushouse@${office.slice('ushouse:'.length)}`
            : office;
          results[`${electionId}/${key}`] = {
            cd: bucket.cd ? Number(bucket.cd) : null,
            total: bucket.total,
            byMode: compactModes(bucket.byMode),
            cands,
          };
        }
      }
      const turnout = {};
      for (const [electionId, byOffice] of byElection) {
        const reg = byOffice.get('registered');
        const cast = byOffice.get('ballots');
        if (reg || cast) {
          turnout[electionId] = {
            registered: reg?.total ?? null,
            ballots: cast?.total ?? null,
            byMode: cast ? compactModes(cast.byMode) : null,
          };
        }
      }
      return {
        geoid,
        name: muni.name,
        county: titleCounty(muni.county),
        type: muni.type_,
        sqMiles: round(muni.sqMiles, 2),
        pop2010: muni.pop2010 ?? null,
        inDistrict: share > 0.999 ? 'whole' : 'split',
        districtShare: round(share, 4),
        otherDistricts: others,
        results,
        turnout,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  /**
   * How each county files its ballots.
   *
   * Hunterdon separates vote-by-mail; Union files provisional and overseas
   * lines; Warren, Sussex, Somerset and Morris fold every ballot into the
   * district rows. A district-wide "mail share" choropleth built on this would
   * draw county paperwork and read as voter behaviour — Hunterdon at 22% next
   * to Morris at nil — so the app does not offer one, and shows this table
   * where the question comes up instead.
   */
  const voteModeFiling = {};
  for (const m of municipalities) {
    const r = m.results['g2024/president'];
    if (!r) continue;
    const c = (voteModeFiling[m.county] ??= { total: 0, modes: {} });
    for (const [mode, v] of Object.entries(r.byMode)) {
      c.modes[mode] = (c.modes[mode] ?? 0) + v;
      c.total += v;
    }
  }
  for (const c of Object.values(voteModeFiling)) {
    c.separates = Object.keys(c.modes).filter((k) => k !== 'machine');
    c.shares = Object.fromEntries(
      Object.entries(c.modes).map(([k, v]) => [k, round(v / c.total, 4)]),
    );
    delete c.modes;
  }

  /**
   * The district's own House race, as it was actually certified.
   *
   * This is a different question from every other row in the panel, and
   * getting them confused is how a site ends up asserting that Leonard Lance
   * beat Tom Malinowski in 2018. He did not — Malinowski won by five points.
   *
   * The rest of the panel answers "how did the *current* 94 towns vote", which
   * is the right question for a statewide race, where every town voted in the
   * same contest. For a House race it is incoherent: 29 of today's towns voted
   * in a different district's election that year, so there is no NJ-07 result
   * for today's territory. What there is, is the election that happened — over
   * the towns that were in the district *then*, including the ones since
   * drawn out of it. That is what this computes, and it reproduces the
   * certified result for all three cycles.
   */
  function certifiedHouseRaces() {
    const out = {};
    const memberIds = new Set(members.map((m) => m.geoid));
    for (const [geoid, byElection] of store) {
      for (const [electionId, byOffice] of byElection) {
        const bucket = byOffice.get(`ushouse:${DISTRICT}`);
        if (!bucket) continue;
        const race = (out[electionId] ??= {
          total: 0,
          cands: new Map(),
          towns: 0,
          townsStillInDistrict: 0,
        });
        race.towns++;
        if (memberIds.has(geoid)) race.townsStillInDistrict++;
        race.total += bucket.total;
        for (const [candKey, c] of bucket.cands) {
          const settled = settleCandidate(c, registry.get(`${electionId}/ushouse:${DISTRICT}`)?.get(candKey));
          const e = (race.cands.get(candKey) ?? { name: settled.name, party: settled.party, votes: 0 });
          e.party ??= settled.party;
          e.votes += settled.votes;
          race.cands.set(candKey, e);
        }
      }
    }
    // County-filed overseas and federal ballots belong to no town, but they
    // are part of the certification, so the certified row carries them.
    for (const u of unassigned) {
      if (u.office !== 'ushouse' || u.district !== DISTRICT) continue;
      const race = out[u.election];
      if (!race) continue;
      race.total += u.votes;
      const k = candidateKey(u.candidate) || u.candidate;
      const e = race.cands.get(k) ?? { name: u.candidate, party: u.party, votes: 0 };
      e.party ??= u.party;
      e.votes += u.votes;
      race.cands.set(k, e);
    }
    return Object.fromEntries(
      Object.entries(out).map(([k, r]) => [
        k,
        {
          total: r.total,
          towns: r.towns,
          townsStillInDistrict: r.townsStillInDistrict,
          cands: [...r.cands.values()].sort((a, b) => b.votes - a.votes),
        },
      ]),
    );
  }

  /**
   * Places where the certification does not add up.
   *
   * A town cannot cast more votes in one race than it cast ballots, and two
   * do. These are discrepancies in the source, not in this pipeline, and the
   * response is to publish them rather than round them away: Union County's
   * Winfield rows are scrambled — the vote totals sit under labels reading
   * "Overseas Ballots" while the district rows hold almost nothing — and
   * Fanwood is out by a single vote, which is ordinary clerical noise.
   */
  const sourceAnomalies = [];
  for (const m of municipalities) {
    const t = m.turnout.g2024;
    if (!t?.ballots) continue;
    for (const [key, res] of Object.entries(m.results)) {
      if (!key.startsWith('g2024') || res.total <= t.ballots) continue;
      sourceAnomalies.push({
        municipality: m.name,
        county: m.county,
        race: key,
        votes: res.total,
        ballots: t.ballots,
        excess: res.total - t.ballots,
      });
    }
  }
  if (sourceAnomalies.length) {
    log(
      'elections',
      `${sourceAnomalies.length} race(s) report more votes than ballots — carried as source anomalies`,
    );
  }

  const districtTotals = totalsFor(municipalities);
  const certifiedHouse = certifiedHouseRaces();

  const payload = {
    meta: {
      state: 'NJ',
      district: Number(DISTRICT),
      generatedAt: new Date().toISOString().slice(0, 10),
      elections: ELECTIONS.map((e) => ({
        id: e.id,
        year: e.year,
        date: e.date,
        label: e.label,
        level: e.level,
      })),
      membership: {
        method:
          'Every precinct in all 21 New Jersey counties carries the congressional ' +
          'district it voted in; the municipalities that appear on a CD-7 ballot ' +
          'in the 2024 general are the district.',
        municipalities: municipalities.length,
        whole: municipalities.filter((m) => m.inDistrict === 'whole').length,
        split: municipalities.filter((m) => m.inDistrict === 'split').length,
        counties: [...new Set(municipalities.map((m) => m.county))].sort(),
      },
      gaps: [
        {
          id: 'cycle-2020',
          what: '2020 presidential and House results',
          why:
            'OpenElections has transcribed 3 of 21 New Jersey counties for 2020, ' +
            'and none of the four largest inside this district. A baseline built ' +
            'from part of a district would read as a fact rather than a fragment.',
        },
        {
          id: 'cycle-2022',
          what: '2022 House results — the 0.8-point Kean/Malinowski race',
          why:
            'No NJ-07 county has been transcribed for 2022. It is the first ' +
            'election held on this district’s current lines, and it is missing.',
        },
        {
          id: 'demographics',
          what: 'Census demographics by municipality',
          why:
            'Population and density here are the 2010 counts carried in the state ' +
            'boundary file. Current ACS estimates need api.census.gov, which this ' +
            'build does not reach.',
        },
      ],
      unassignedVotes: unassigned.reduce((a, r) => a + r.votes, 0),
      /**
       * NJ-07 ballots the counties file at county level — overseas and federal
       * voters, who belong to no municipality by construction. District totals
       * are the sum of municipalities and do not include these, which is why
       * the topline here sits a hair under the statewide certification.
       */
      districtUnassigned: {
        votes: unassigned
          .filter((u) => u.district === DISTRICT)
          .reduce((a, r) => a + r.votes, 0),
        rows: unassigned.filter((u) => u.district === DISTRICT).length,
        places: [
          ...new Set(
            unassigned.filter((u) => u.district === DISTRICT).map((u) => `${u.county} · ${u.place}`),
          ),
        ],
      },
      unresolvedRows: [...unresolved]
        .map(([k, votes]) => ({ row: k, votes }))
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 40),
      abbreviationCodes: codeReports,
      voteModeFiling,
      sourceAnomalies,
      droppedRows: [...dropped].map(([row, votes]) => ({ row, votes })).sort((a, b) => b.votes - a.votes),
      spellingCorrections: corrections,
    },
    district: districtTotals,
    certifiedHouse,
    municipalities,
    unassigned: unassigned.filter((u) => u.district === DISTRICT),
  };

  await writeJSON('district.json', payload);
  log(
    'elections',
    `${municipalities.length} municipalities; ` +
      `${unassigned.reduce((a, r) => a + r.votes, 0).toLocaleString()} votes in rows that name ` +
      'no municipality (county-wide federal ballots)',
  );
  return { municipalities: municipalities.length };
}

/** Drop the modes a row never used, so the file is not mostly zeroes. */
function compactModes(modes) {
  const out = {};
  for (const [k, v] of Object.entries(modes)) if (v) out[k] = v;
  return out;
}

const titleCounty = (c) =>
  c.replace(/_/g, ' ').replace(/\b[a-z]/g, (m) => m.toUpperCase());

/**
 * District-wide totals.
 *
 * Split municipalities are the whole reason this is not a plain sum. Their
 * House votes are already district-only — that is how the split was measured —
 * but their presidential votes are not, so the presidential row prorates them
 * by the House share and says so. It is an estimate, and it is labelled one
 * everywhere it appears.
 */
function totalsFor(municipalities) {
  const out = {};
  for (const m of municipalities) {
    for (const [key, res] of Object.entries(m.results)) {
      if (key.includes('/ushouse@')) continue;
      const isHouse = key.endsWith('/ushouse');
      // A split town's other-district House race is a different race.
      if (isHouse && res.cd !== Number(DISTRICT)) continue;
      const scale = isHouse || m.inDistrict === 'whole' ? 1 : m.districtShare;
      const t = (out[key] ??= { total: 0, cands: new Map(), prorated: false, munis: 0 });
      t.munis++;
      if (scale !== 1) t.prorated = true;
      t.total += res.total * scale;
      for (const c of res.cands) {
        const k = candidateKey(c.name) || c.name;
        if (!t.cands.has(k)) t.cands.set(k, { name: c.name, party: c.party, votes: 0 });
        const entry = t.cands.get(k);
        entry.party ??= c.party;
        entry.votes += c.votes * scale;
      }
    }
  }
  const shaped = {};
  for (const [key, t] of Object.entries(out)) {
    shaped[key] = {
      total: Math.round(t.total),
      prorated: t.prorated,
      municipalities: t.munis,
      cands: [...t.cands.values()]
        .map((c) => ({ ...c, votes: Math.round(c.votes) }))
        .sort((a, b) => b.votes - a.votes),
    };
  }
  return shaped;
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
