/** Map stage plus the things anchored to it: hover card, layer controls. */
import { useRef, useState } from 'react';
import HoverCard from './HoverCard';
import LayerControls from './LayerControls';
import MapStage from './MapStage';
import { metricById } from '../lib/metrics';
import { useUI } from '../lib/store';
import type { DistrictFile } from '../lib/types';

export default function MapPane({
  topo,
  district,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  topo: any;
  district: DistrictFile;
}) {
  const municipalities = district.municipalities;
  const host = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const { hover, metric: metricId } = useUI();
  const metric = metricById(district, metricId);
  const hovered = hover ? municipalities.find((m) => m.geoid === hover) : null;

  return (
    <div
      ref={host}
      className="relative h-full w-full"
      onMouseMove={(e) => {
        const r = host.current?.getBoundingClientRect();
        if (!r) return;
        setPointer({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
      }}
      onMouseLeave={() => setPointer(null)}
    >
      <MapStage topo={topo} municipalities={municipalities} metric={metric} />
      {hovered && pointer ? (
        <HoverCard
          muni={hovered}
          metric={metric}
          x={pointer.x}
          y={pointer.y}
          width={pointer.w}
          height={pointer.h}
        />
      ) : null}
      <LayerControls district={district} />
    </div>
  );
}
