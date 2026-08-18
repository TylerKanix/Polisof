/** UI state. Small on purpose: anything derivable is derived, not stored. */
import { create } from 'zustand';

interface UIState {
  /** GEOID of the municipality in the side panel, or null for the district. */
  selected: string | null;
  hover: string | null;
  metric: string;
  labels: boolean;
  paletteOpen: boolean;
  provenanceOpen: boolean;
  /** Rail sort: by the active metric, or alphabetical. */
  sort: 'metric' | 'name' | 'size';

  select: (geoid: string | null) => void;
  setHover: (geoid: string | null) => void;
  setMetric: (id: string) => void;
  toggleLabels: () => void;
  setPalette: (open: boolean) => void;
  setProvenance: (open: boolean) => void;
  setSort: (sort: 'metric' | 'name' | 'size') => void;
}

export const useUI = create<UIState>((set) => ({
  selected: null,
  hover: null,
  metric: 'house24',
  labels: true,
  paletteOpen: false,
  provenanceOpen: false,
  sort: 'metric',

  select: (geoid) => set({ selected: geoid }),
  setHover: (geoid) => set({ hover: geoid }),
  setMetric: (id) => set({ metric: id }),
  toggleLabels: () => set((s) => ({ labels: !s.labels })),
  setPalette: (open) => set({ paletteOpen: open }),
  setProvenance: (open) => set({ provenanceOpen: open }),
  setSort: (sort) => set({ sort }),
}));
