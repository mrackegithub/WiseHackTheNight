export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1',
  /** Mocks are on in dev unless explicitly disabled with VITE_USE_MOCKS=false. Never in production builds. */
  useMocks: import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS !== 'false',
  mapTileUrl: import.meta.env.VITE_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};
