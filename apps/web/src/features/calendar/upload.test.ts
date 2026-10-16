import { describe, expect, it } from 'vitest';
import { icsUploadForm } from './upload';

describe('icsUploadForm', () => {
  it('puts the File itself under the contract field "file"', () => {
    const file = new File(['BEGIN:VCALENDAR'], 'timetable.ics', { type: 'text/calendar' });
    const form = icsUploadForm({ file: file as unknown as string });
    const entry = form.get('file') as File;
    expect(entry.name).toBe('timetable.ics');
    expect(entry.type).toBe('text/calendar');
    expect(entry.size).toBe(file.size);
  });
});
