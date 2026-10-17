export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1',
  /** Phase 2: the real API by default. VITE_USE_MOCKS=true runs the in-browser MSW mocks instead (dev only, never in builds). */
  useMocks: import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true',
  mapTileUrl: import.meta.env.VITE_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};
