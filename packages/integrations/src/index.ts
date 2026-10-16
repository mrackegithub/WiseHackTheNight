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
export { SimpleGeoService, geoService } from './geo/geo';
