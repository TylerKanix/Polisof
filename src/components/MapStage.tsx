/**
 * The map.
 *
 * One Albers USA projection for both views. Zooming into a state is a
 * transform on the shared group rather than a reprojection, so the animation
 * is continuous and county paths never have to be regenerated mid-flight.
 *
 * Rendering strategy: SVG throughout. County paths are generated once per
 * state and memoised; the national county layer (3,142 paths) is generated
 * lazily and only when the reader turns it on.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { useUI } from '../lib/store';
import { METRIC_BY_ID, metricColor, type MetricContext } from '../lib/metrics';
import { HATCH_ID, NO_DATA, PARTY } from '../lib/palette';
import type { CensusFile, PlacesFile, RacesFile, ResultsFile, StateMeta } from '../lib/types';
import { baselineRating } from '../lib/analysis';
import { loadPlaces } from '../lib/data';
import HoverCard from './HoverCard';

const W = 975;
const H = 610;
const PROJECTION = geoAlbersUsa().scale(1300).translate([W / 2, H / 2 - 5]);
const PATH = geoPath(PROJECTION);

interface Props {
  statesTopo: any;
  countiesTopo: any;
  stateMeta: Record<string, StateMeta>;
  races: RacesFile;
  results: ResultsFile;
  census: CensusFile;
  photos: Set<string>;
}

interface Shape {
  fips: string;
  name: string;
  d: string;
}

export default function MapStage(props: Props) {
  const { statesTopo, countiesTopo, stateMeta, races, results, census, photos } = props;
  const {
    focusState,
    focus,
    hoverState,
    setHoverState,
    hoverCounty,
    setHoverCounty,
    selectedCounty,
    selectCounty,
    metric,
    nationalCounties,
    showTowns,
  } = useUI();

  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ctx: MetricContext = useMemo(
    () => ({ results, census: census.counties }),
    [results, census],
  );
  const activeMetric = METRIC_BY_ID[metric] ?? METRIC_BY_ID.margin24;

  // ── Geometry, generated once ──────────────────────────────────────────
  const stateShapes = useMemo<Shape[]>(() => {
    const fc = feature(statesTopo, statesTopo.objects.states) as any;
    return fc.features
      .map((f: any) => ({
        fips: String(f.id).padStart(2, '0'),
        name: f.properties.name,
        d: PATH(f) ?? '',
      }))
      .filter((s: Shape) => s.d);
  }, [statesTopo]);

  const allCountyFeatures = useMemo(() => {
    const fc = feature(countiesTopo, countiesTopo.objects.counties) as any;
    return fc.features as any[];
  }, [countiesTopo]);

  // Counties for the focused state only — the common case, and cheap.
  const countyShapes = useMemo<Shape[]>(() => {
    if (!focusState && !nationalCounties) return [];
    const wanted = focusState
      ? allCountyFeatures.filter((f) => String(f.id).padStart(5, '0').startsWith(focusState))
      : allCountyFeatures;
    return wanted
      .map((f) => ({
        fips: String(f.id).padStart(5, '0'),
        name: f.properties.name,
        d: PATH(f) ?? '',
      }))
      .filter((s) => s.d);
  }, [allCountyFeatures, focusState, nationalCounties]);

  // ── Zoom transform ────────────────────────────────────────────────────
  const transform = useMemo(() => {
    if (!focusState) return { k: 1, x: 0, y: 0 };
    const meta = stateMeta[focusState];
    if (!meta) return { k: 1, x: 0, y: 0 };
    const [x0, y0, x1, y1] = meta.bounds;
    const bw = Math.max(x1 - x0, 1);
    const bh = Math.max(y1 - y0, 1);
    // 0.82 leaves room for the town labels that spill past a county edge.
    const k = Math.min((W / bw) * 0.82, (H / bh) * 0.82, 14);
    return { k, x: W / 2 - k * ((x0 + x1) / 2), y: H / 2 - k * ((y0 + y1) / 2) };
  }, [focusState, stateMeta]);

  // ── Races by state, for the national colouring ────────────────────────
  const raceByState = useMemo(() => {
    const m = new Map<string, (typeof races.races)[number]>();
    for (const r of races.races) {
      // A state with both a regular and a special race colours by the closer one.
      const existing = m.get(r.stateFips);
      if (!existing) m.set(r.stateFips, r);
      else {
        const a = baselineRating({
          state: results.states[r.stateFips],
          incumbentParty: r.seatHolder.party,
          open: r.open,
          appointed: r.seatHolder.appointed,
        });
        const b = baselineRating({
          state: results.states[existing.stateFips],
          incumbentParty: existing.seatHolder.party,
          open: existing.open,
          appointed: existing.seatHolder.appointed,
        });
        if ((a?.competitiveness ?? 0) > (b?.competitiveness ?? 0)) m.set(r.stateFips, r);
      }
    }
    return m;
  }, [races, results]);

  const stateFill = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stateShapes) {
      const race = raceByState.get(s.fips);
      if (!race) {
        m.set(s.fips, NO_DATA);
        continue;
      }
      const b = baselineRating({
        state: results.states[s.fips],
        incumbentParty: race.seatHolder.party,
        open: race.open,
        appointed: race.seatHolder.appointed,
      });
      m.set(s.fips, b ? ratingFill(b.expected) : NO_DATA);
    }
    return m;
  }, [stateShapes, raceByState, results]);

  // ── Towns ─────────────────────────────────────────────────────────────
  const [places, setPlaces] = useState<PlacesFile | null>(null);
  useEffect(() => {
    if (!focusState) {
      setPlaces(null);
      return;
    }
    let live = true;
    loadPlaces(focusState)
      .then((p) => live && setPlaces(p))
      .then(undefined, () => live && setPlaces(null));
    return () => {
      live = false;
    };
  }, [focusState]);

  const townMarks = useMemo(() => {
    if (!places || !showTowns || !focusState) return [];
    const out: { n: string; x: number; y: number; c: string | null }[] = [];
    for (const p of places.places) {
      const xy = PROJECTION([p.x, p.y]);
      if (!xy) continue;
      out.push({ n: p.n, x: xy[0], y: xy[1], c: p.c });
    }
    return out;
  }, [places, showTowns, focusState]);

  /**
   * Labels are placed greedily with collision rejection in projected space, so
   * a dense corner of the state shows a readable subset instead of a smear.
   * Sorted by population when it is known (after a census sync) and
   * alphabetically otherwise.
   */
  const townLabels = useMemo(() => {
    if (!townMarks.length) return [];
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const out: typeof townMarks = [];
    const charW = 4.6 / transform.k;
    const lineH = 11 / transform.k;
    for (const t of townMarks) {
      const w = t.n.length * charW;
      const box = { x0: t.x + 3 / transform.k, y0: t.y - lineH / 2, x1: t.x + 3 / transform.k + w, y1: t.y + lineH / 2 };
      const hits = placed.some(
        (p) => !(box.x1 < p.x0 || box.x0 > p.x1 || box.y1 < p.y0 || box.y0 > p.y1),
      );
      if (hits) continue;
      placed.push(box);
      out.push(t);
      if (out.length > 60) break;
    }
    return out;
  }, [townMarks, transform.k]);

  // ── Interaction ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusState) focus(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusState, focus]);

  const trackPointer = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const hoveredRace = !focusState && hoverState ? raceByState.get(hoverState) : undefined;
  const hoveredBaseline = hoveredRace
    ? baselineRating({
        state: results.states[hoveredRace.stateFips],
        incumbentParty: hoveredRace.seatHolder.party,
        open: hoveredRace.open,
        appointed: hoveredRace.seatHolder.appointed,
      })
    : null;

  return (
    <div ref={wrapRef} className="relative h-full w-full" onMouseMove={trackPointer}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full"
        role="img"
        aria-label={
          focusState
            ? `County map of ${stateMeta[focusState]?.name}`
            : '2026 United States Senate election map'
        }
        onMouseLeave={() => {
          setHoverState(null);
          setHoverCounty(null);
          setPointer(null);
        }}
      >
        <defs>
          <pattern id={HATCH_ID} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill={NO_DATA} />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#2b3140" strokeWidth="2" />
          </pattern>
          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
            transition: 'transform 620ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {/* National state layer. Kept mounted while zoomed so the
              surrounding states remain as context instead of a void. */}
          <g>
            {stateShapes.map((s) => {
              const isFocus = focusState === s.fips;
              const dimmed = focusState && !isFocus;
              const contested = raceByState.has(s.fips);
              return (
                <path
                  key={s.fips}
                  d={s.d}
                  fill={
                    dimmed
                      ? '#151922'
                      : contested
                        ? stateFill.get(s.fips)
                        : `url(#${HATCH_ID})`
                  }
                  stroke={isFocus ? '#8fa0bd' : '#0b0d12'}
                  strokeWidth={(isFocus ? 1.4 : 0.9) / transform.k}
                  strokeLinejoin="round"
                  opacity={dimmed ? 0.55 : 1}
                  className={focusState ? '' : 'cursor-pointer'}
                  style={{
                    transition: 'opacity 400ms ease, fill 300ms ease',
                    filter:
                      !focusState && hoverState === s.fips && contested ? 'url(#glow)' : undefined,
                  }}
                  onMouseEnter={() => !focusState && setHoverState(s.fips)}
                  onClick={() => {
                    if (focusState) return;
                    if (contested) focus(s.fips);
                  }}
                  aria-label={s.name}
                />
              );
            })}
          </g>

          {/* County layer */}
          {countyShapes.length > 0 && (
            <g>
              {countyShapes.map((c) => {
                const fill = metricColor(activeMetric, c.fips, ctx);
                return (
                  <path
                    key={c.fips}
                    d={c.d}
                    fill={fill}
                    stroke="#0b0d12"
                    strokeWidth={0.55 / transform.k}
                    strokeLinejoin="round"
                    className="cursor-pointer"
                    style={{ transition: 'fill 260ms ease' }}
                    onMouseEnter={() => setHoverCounty(c.fips)}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectCounty(selectedCounty === c.fips ? null : c.fips);
                    }}
                    aria-label={c.name}
                  />
                );
              })}
            </g>
          )}

          {/* Selection and hover outlines, drawn above every county fill so
              paint order cannot bury them under a neighbouring county. */}
          {countyShapes.length > 0 && (
            <g pointerEvents="none">
              {hoverCounty && hoverCounty !== selectedCounty && (
                <path
                  d={countyShapes.find((c) => c.fips === hoverCounty)?.d ?? ''}
                  fill="none"
                  stroke="#c9d3e6"
                  strokeWidth={1.7 / transform.k}
                  strokeLinejoin="round"
                />
              )}
              {selectedCounty && (
                <path
                  d={countyShapes.find((c) => c.fips === selectedCounty)?.d ?? ''}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={2.6 / transform.k}
                  strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.55))' }}
                />
              )}
            </g>
          )}

          {/* Focused state outline, drawn above the counties */}
          {focusState && (
            <path
              d={stateShapes.find((s) => s.fips === focusState)?.d ?? ''}
              fill="none"
              stroke="#aab7cc"
              strokeWidth={1.6 / transform.k}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}

          {/* Towns */}
          {focusState && showTowns && (
            <g pointerEvents="none">
              {townMarks.map((t) => (
                <circle
                  key={`${t.n}-${t.x}-${t.y}`}
                  cx={t.x}
                  cy={t.y}
                  r={1.7 / transform.k}
                  fill="#e7ecf5"
                  opacity={0.5}
                />
              ))}
              {townLabels.map((t) => (
                <text
                  key={`l-${t.n}-${t.x}`}
                  x={t.x + 3 / transform.k}
                  y={t.y + 3 / transform.k}
                  fill="#dfe6f2"
                  fontSize={9 / transform.k}
                  className="font-sans"
                  style={{
                    paintOrder: 'stroke',
                    stroke: '#0b0d12',
                    strokeWidth: 2.4 / transform.k,
                    strokeLinejoin: 'round',
                  }}
                >
                  {t.n}
                </text>
              ))}
            </g>
          )}
        </g>

        {/* State abbreviations at the national view */}
        {!focusState && (
          <g pointerEvents="none">
            {stateShapes.map((s) => {
              const meta = stateMeta[s.fips];
              if (!meta || !raceByState.has(s.fips)) return null;
              if (meta.area < 900) return null; // too small to hold a label
              return (
                <text
                  key={`ab-${s.fips}`}
                  x={meta.centroid[0]}
                  y={meta.centroid[1] + 3}
                  textAnchor="middle"
                  className="font-mono font-semibold"
                  fontSize={10}
                  fill="#e8edf6"
                  opacity={hoverState === s.fips ? 1 : 0.72}
                  style={{
                    paintOrder: 'stroke',
                    stroke: '#0b0d1288',
                    strokeWidth: 2.5,
                    strokeLinejoin: 'round',
                  }}
                >
                  {meta.abbr}
                </text>
              );
            })}
          </g>
        )}
      </svg>

      {/* Small-state leader chips: RI/DE/CT and friends are unclickable at
          this scale, so they get a rail of their own rather than being lost. */}
      {!focusState && (
        <SmallStateRail
          stateMeta={stateMeta}
          raceByState={raceByState}
          fill={stateFill}
          onHover={setHoverState}
          onSelect={focus}
        />
      )}

      {!focusState && <NationalLegend />}

      {hoveredRace && pointer && (
        <HoverCard
          race={hoveredRace}
          baseline={hoveredBaseline}
          photos={photos}
          x={pointer.x}
          y={pointer.y}
          width={size.w}
          height={size.h}
        />
      )}
    </div>
  );
}

/**
 * Fill for the national rating map.
 *
 * Note this is NOT the county margin ramp, and deliberately so. The county map
 * encodes magnitude, where a coin-flip county should recede. This map encodes
 * a rating, and the whole point of it is to find the seats in play — so a
 * tossup is the loudest thing on it, in a light neutral that cannot be
 * mistaken for either party or for the hatch on seats not up this cycle.
 */
export const TOSSUP_FILL = '#7f8798';

function ratingFill(expected: number): string {
  const abs = Math.abs(expected);
  const p = expected > 0 ? PARTY.R : PARTY.D;
  if (abs < 3) return TOSSUP_FILL;
  if (abs < 8) return p.deep;
  if (abs < 15) return p.base;
  return p.bright;
}

const SmallStateRail = memo(function SmallStateRail({
  stateMeta,
  raceByState,
  fill,
  onHover,
  onSelect,
}: {
  stateMeta: Record<string, StateMeta>;
  raceByState: Map<string, unknown>;
  fill: Map<string, string>;
  onHover: (f: string | null) => void;
  onSelect: (f: string | null) => void;
}) {
  const small = Object.values(stateMeta)
    .filter((m) => m.area < 900 && raceByState.has(m.fips))
    .sort((a, b) => a.abbr.localeCompare(b.abbr));
  if (!small.length) return null;
  return (
    <div className="pointer-events-auto absolute right-3 top-3 flex flex-col gap-1">
      {small.map((m) => (
        <button
          key={m.fips}
          onMouseEnter={() => onHover(m.fips)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onSelect(m.fips)}
          className="flex items-center gap-1.5 rounded border border-hairline bg-surface/80 px-1.5 py-1 font-mono text-[10px] text-ink-2 backdrop-blur transition hover:border-white/25 hover:text-ink"
        >
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: fill.get(m.fips) }} />
          {m.abbr}
        </button>
      ))}
    </div>
  );
});


/** What the national map's colours mean. Only shown at the national view. */
function NationalLegend() {
  const rows: [string, string][] = [
    ['Solid D', PARTY.D.bright],
    ['Likely D', PARTY.D.base],
    ['Lean D', PARTY.D.deep],
    ['Tossup', TOSSUP_FILL],
    ['Lean R', PARTY.R.deep],
    ['Likely R', PARTY.R.base],
    ['Solid R', PARTY.R.bright],
  ];
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-white/12 bg-plane/95 px-3 py-2 shadow-lift backdrop-blur">
      <div className="mb-1.5 text-[9px] uppercase tracking-[0.16em] text-ink-3">
        Polisof baseline rating
      </div>
      <div className="flex items-center gap-0">
        {rows.map(([label, color]) => (
          <div key={label} className="flex flex-col items-center" style={{ width: 46 }}>
            <div className="h-2.5 w-full" style={{ background: color }} title={label} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between text-[8.5px] text-ink-3">
        <span>Solid D</span>
        <span className="text-ink-2">Tossup</span>
        <span>Solid R</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 border-t border-hairline pt-1.5 text-[8.5px] text-ink-3">
        <svg width="11" height="11" aria-hidden>
          <rect width="11" height="11" fill={`url(#${HATCH_ID})`} />
        </svg>
        not on the 2026 ballot
      </div>
    </div>
  );
}
