import { describe, expect, it } from 'vitest';
import { courseFromTitle, normalizeCourseName } from '../src/neptun/courses';

describe('courseFromTitle', () => {
  it('extracts title and code from standard Neptun format with group specifier', () => {
    const result = courseFromTitle('Digitális technika (BMEVIMIAA00 - EA)');
    expect(result).toEqual({
      name: 'Digitális technika',
      code: 'BMEVIMIAA00',
    });
  });

  it('extracts title and code from course with hyphenated ELTE code and no group specifier', () => {
    const result = courseFromTitle('Algorithms and Data Structures I (IP-18AA1E) - Előadás');
    expect(result).toEqual({
      name: 'Algorithms and Data Structures I',
      code: 'IP-18AA1E',
    });
  });

  it('extracts title and code when no group specifier or suffix is present', () => {
    const result = courseFromTitle('Digital Design (BMEVIAUA000)');
    expect(result).toEqual({
      name: 'Digital Design',
      code: 'BMEVIAUA000',
    });
  });

  it('extracts title without code when code is omitted in brackets', () => {
    const result = courseFromTitle('Digitális technika ( - EA) - Dr. Pálfi');
    expect(result).toEqual({
      name: 'Digitális technika',
    });
  });

  it('extracts title and code when course code has hyphens and group specifier is present', () => {
    const result = courseFromTitle('Algorithms and Data Structures I (IP-18AA1E - EA)');
    expect(result).toEqual({
      name: 'Algorithms and Data Structures I',
      code: 'IP-18AA1E',
    });
  });

  it('returns null for non-matching strings', () => {
    expect(courseFromTitle('')).toBeNull();
    expect(courseFromTitle('Just a random title without brackets')).toBeNull();
  });
});

describe('normalizeCourseName', () => {
  it('normalizes accents, casing, and punctuation', () => {
    expect(normalizeCourseName('Digitális technika!')).toBe('digitalis technika');
    expect(normalizeCourseName('Algorithms & Data Structures')).toBe('algorithms data structures');
  });
});
