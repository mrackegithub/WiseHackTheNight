// Public surface of @sgm/integrations. Agent B imports from here, never from deep paths.
export type { TimeSlot, AvailabilityService, GeoService, BookingProvider } from './ports';
export {
  intersectSlots,
  mergeSlots,
  subtractSlots,
  intersectMultipleSlots,
  slotDurationMinutes,
  totalDurationMinutes,
} from './slots/slots';
export { expandWeeklyWindows, type WeeklyWindow } from './slots/windows';
export {
  AvailabilityServiceImpl,
  DEFAULT_WEEKLY_WINDOWS,
  type AvailabilityDb,
  type AvailabilityWindowRecord,
  type CalendarEventRecord,
} from './slots/availability';
export { SimpleGeoService, geoService } from './geo/geo';
export {
  NominatimGeocoder,
  geocoder,
  type GeoPointResult,
  type GeocodeOptions,
} from './geo/geocoding';
export {
  normalizeCalendarUrl,
  isPrivateIp,
  validateSafeUrl,
  fetchIcs,
  type FetchIcsOptions,
} from './neptun/ssrf';
export {
  extractCourseCodes,
  parseIcs,
  type ParsedCalendarEvent,
  type ParseIcsOptions,
} from './neptun/parser';
export { encryptUrl, decryptUrl, getEncryptionKey } from './neptun/crypto';
export {
  MockBookingProvider,
  LibCalProvider,
  MsGraphProvider,
  type BookingDb,
  type RoomRecord,
  type BookingRecord,
} from './booking/providers';
