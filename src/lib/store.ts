/** UI state. Deliberately small: everything derivable is derived, not stored. */
import { create } from 'zustand';

export type View = 'national' | 'state';

interface UIState {
  view: View;
  /** State FIPS currently zoomed into, or null at the national view. */
  focusState: string | null;
  hoverState: string | null;
  hoverCounty: string | null;
  selectedCounty: string | null;
  selectedPlace: string | null;
  /** Active county choropleth layer id (see metrics.ts). */
  metric: string;
  /** Draw counties at the national view too, not just inside a state. */
  nationalCounties: boolean;
  showTowns: boolean;
  dossierOpen: boolean;
  paletteOpen: boolean;
  provenanceOpen: boolean;
  watchlist: string[];
  compare: string[];

  focus: (fips: string | null) => void;
  setHoverState: (fips: string | null) => void;
  setHoverCounty: (fips: string | null) => void;
  selectCounty: (fips: string | null) => void;
  selectPlace: (name: string | null) => void;
  setMetric: (id: string) => void;
  toggleNationalCounties: () => void;
  toggleTowns: () => void;
  setDossier: (open: boolean) => void;
  setPalette: (open: boolean) => void;
  setProvenance: (open: boolean) => void;
  toggleWatch: (raceId: string) => void;
  toggleCompare: (raceId: string) => void;
  reset: () => void;
}

export const useUI = create<UIState>((set) => ({
  view: 'national',
  focusState: null,
  hoverState: null,
  hoverCounty: null,
  selectedCounty: null,
  selectedPlace: null,
  metric: 'margin24',
  nationalCounties: false,
  showTowns: true,
  dossierOpen: false,
  paletteOpen: false,
  provenanceOpen: false,
  watchlist: [],
  compare: [],

  focus: (fips) =>
    set(() => ({
      focusState: fips,
      view: fips ? 'state' : 'national',
      // Leaving a state must not strand a county panel from the old one.
      selectedCounty: null,
      selectedPlace: null,
      hoverCounty: null,
      dossierOpen: Boolean(fips),
    })),
  setHoverState: (fips) => set({ hoverState: fips }),
  setHoverCounty: (fips) => set({ hoverCounty: fips }),
  selectCounty: (fips) => set({ selectedCounty: fips, selectedPlace: null }),
  selectPlace: (name) => set({ selectedPlace: name }),
  setMetric: (id) => set({ metric: id }),
  toggleNationalCounties: () => set((s) => ({ nationalCounties: !s.nationalCounties })),
  toggleTowns: () => set((s) => ({ showTowns: !s.showTowns })),
  setDossier: (open) => set({ dossierOpen: open }),
  setPalette: (open) => set({ paletteOpen: open }),
  setProvenance: (open) => set({ provenanceOpen: open }),
  toggleWatch: (raceId) =>
    set((s) => ({
      watchlist: s.watchlist.includes(raceId)
        ? s.watchlist.filter((r) => r !== raceId)
        : [...s.watchlist, raceId],
    })),
  toggleCompare: (raceId) =>
    set((s) => ({
      compare: s.compare.includes(raceId)
        ? s.compare.filter((r) => r !== raceId)
        : [...s.compare, raceId].slice(-3),
    })),
  reset: () =>
    set({
      view: 'national',
      focusState: null,
      selectedCounty: null,
      selectedPlace: null,
      hoverCounty: null,
      dossierOpen: false,
    }),
}));
