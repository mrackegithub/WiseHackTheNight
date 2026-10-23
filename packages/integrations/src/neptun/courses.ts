/** A course found in a timetable title. `code` is empty when Neptun leaves it out (it usually does). */
export interface TimetableCourse {
  name: string;
  code?: string;
}

// Neptun class titles look like "Digitális technika (BMEVIMIAA00 - EA) - Dr. Pálfi Vilmos - Tanóra", and often
// "Digitális technika ( - EA) - …".
const NEPTUN_CLASS_TITLE = /^(.+?)\s*\(\s*([^()\s]*?)(?:\s+-\s+[^()]*)?\)/;

/** The course a Neptun class title belongs to, or null for deadlines and other non-class entries. */
export function courseFromTitle(title: string): TimetableCourse | null {
  const m = NEPTUN_CLASS_TITLE.exec(title.trim());
  if (!m) return null;
  const name = m[1].trim().replace(/\.$/, '');
  if (!name) return null;
  return m[2] ? { name, code: m[2].toUpperCase() } : { name };
}

/** Case-, accent- and punctuation-insensitive form of a course name, for matching against subject names and aliases. */
export function normalizeCourseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
