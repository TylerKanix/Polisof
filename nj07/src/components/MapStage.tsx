/**
 * The district, drawn once.
 *
 * There is no zoom and no pan. NJ-07 fits on one screen at a readable size,
 * and a map you cannot get lost in is worth more than a map you can explore —
 * every town is always one pointer move away from its number.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { colorFor, domainOf, type Metric } from '../lib/metrics';
import { NO_DATA } from '../lib/palette';
import { shortNames } from '../lib/names';
import { useUI } from '../lib/store';
import type { Municipality } from '../lib/types';

const HATCH_ID = 'nj07-split-hatch';

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  topo: any;
  municipalities: Municipality[];
  metric: Metric;
}

export default function MapStage({ topo, municipalities, metric }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 700 });
  const { hover, selected, labels, setHover, select } = useUI();

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shapes = useMemo(
    () => feature(topo, topo.objects.munis) as unknown as FeatureCollection<Polygon | MultiPolygon>,
    [topo],
  );

  const byGeoid = useMemo(
    () => new Map(municipalities.map((m) => [m.geoid, m])),
    [municipalities],
  );

  const shortNameOf = useMemo(() => shortNames(municipalities), [municipalities]);

  const { path, borders, outline, centroids } = useMemo(() => {
    const projection = geoMercator().fitExtent(
      [
        [18, 18],
        [size.w - 18, size.h - 18],
      ],
      shapes,
    );
    const p = geoPath(projection);
    return {
      path: p,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      borders: p(mesh(topo, topo.objects.munis, (a: any, b: any) => a !== b) as never),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outline: p(mesh(topo, topo.objects.munis, (a: any, b: any) => a === b) as never),
      centroids: new Map(
        shapes.features.map((f) => [String(f.id), { xy: p.centroid(f), area: p.area(f) }]),
      ),
    };
  }, [shapes, topo, size.w, size.h]);

  const domain = useMemo(() => domainOf(metric, municipalities), [metric, municipalities]);

  const active = hover ?? selected;

  return (
    <div ref={host} className="absolute inset-0">
      <svg
        width={size.w}
        height={size.h}
        role="img"
        aria-label={`New Jersey's 7th congressional district, ${municipalities.length} municipalities, shaded by ${metric.label}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <pattern id={HATCH_ID} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="transparent" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(255,255,255,0.42)" strokeWidth="1.4" />
          </pattern>
        </defs>

        <g>
          {shapes.features.map((f) => {
            const geoid = String(f.id);
            const muni = byGeoid.get(geoid);
            const value = muni ? metric.value(muni) : null;
            const isActive = active === geoid;
            const isSelected = selected === geoid;
            return (
              <path
                key={geoid}
                d={path(f as Feature) ?? undefined}
                fill={muni ? colorFor(metric, value, domain) : NO_DATA}
                stroke={isActive ? '#f2f4f8' : 'rgba(0,0,0,0.55)'}
                strokeWidth={isActive ? 1.6 : 0.5}
                strokeLinejoin="round"
                className="cursor-pointer transition-[stroke,stroke-width] duration-150"
                style={{ filter: isSelected ? 'brightness(1.16)' : undefined }}
                onMouseEnter={() => setHover(geoid)}
                onClick={() => select(isSelected ? null : geoid)}
              >
                <title>{muni ? `${muni.name} — ${metric.format(value)}` : geoid}</title>
              </path>
            );
          })}
        </g>

        {/* Towns only partly inside the district, marked rather than footnoted. */}
        <g pointerEvents="none">
          {shapes.features
            .filter((f) => byGeoid.get(String(f.id))?.inDistrict === 'split')
            .map((f) => (
              <path
                key={`split-${f.id}`}
                d={path(f as Feature) ?? undefined}
                fill={`url(#${HATCH_ID})`}
                opacity={0.5}
              />
            ))}
        </g>

        <path d={borders ?? undefined} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={0.6} pointerEvents="none" />
        <path
          d={outline ?? undefined}
          fill="none"
          stroke="rgba(242,244,248,0.72)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          pointerEvents="none"
        />

        {labels ? (
          <g pointerEvents="none">
            {shapes.features.map((f) => {
              const geoid = String(f.id);
              const muni = byGeoid.get(geoid);
              const c = centroids.get(geoid);
              if (!muni || !c || !Number.isFinite(c.xy[0])) return null;
              // Only label towns whose polygon can actually hold the text.
              const room = c.area > 1500;
              if (!room && active !== geoid) return null;
              const short = shortNameOf.get(geoid) ?? muni.name;
              return (
                <text
                  key={`label-${geoid}`}
                  x={c.xy[0]}
                  y={c.xy[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="select-none font-mono"
                  style={{
                    fontSize: active === geoid ? 11 : 9,
                    fill: active === geoid ? '#ffffff' : 'rgba(242,244,248,0.82)',
                    paintOrder: 'stroke',
                    stroke: 'rgba(3,4,7,0.85)',
                    strokeWidth: 2.6,
                    strokeLinejoin: 'round',
                  }}
                >
                  {short}
                </text>
              );
            })}
          </g>
        ) : null}
      </svg>
    </div>
  );
}
