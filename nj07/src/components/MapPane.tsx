/** Map stage plus the things anchored to it: hover card, layer controls. */
import { useRef, useState } from 'react';
import HoverCard from './HoverCard';
import LayerControls from './LayerControls';
import MapStage from './MapStage';
import { METRIC_BY_ID, METRICS } from '../lib/metrics';
import { useUI } from '../lib/store';
import type { Municipality } from '../lib/types';

export default function MapPane({
  topo,
  municipalities,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  topo: any;
  municipalities: Municipality[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const { hover, metric: metricId } = useUI();
  const metric = METRIC_BY_ID.get(metricId) ?? METRICS[0];
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
      <LayerControls municipalities={municipalities} />
    </div>
  );
}
