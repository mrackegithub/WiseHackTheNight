import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from '../api/errors';
import { messageForError } from './error-messages';

describe('messageForError', () => {
  it('switches on the contract error code, not the server message', () => {
    expect(messageForError(new ApiError(409, 'GROUP_FULL', 'internal text'))).toBe('This group is already full.');
    expect(messageForError(new ApiError(409, 'SLOT_TAKEN', ''))).toMatch(/just booked/);
  });

  it('lists the invalid fields for VALIDATION_FAILED', () => {
    const err = toApiError(422, { code: 'VALIDATION_FAILED', message: 'x', details: [{ path: 'email', issue: 'bad' }] });
    expect(messageForError(err)).toBe('Please check: email');
  });

  it('falls back to the server message for unknown codes, and a generic text otherwise', () => {
    expect(messageForError(new ApiError(400, 'SOMETHING_NEW', 'Explained by server'))).toBe('Explained by server');
    expect(messageForError(new Error('boom'))).toMatch(/Something went wrong/);
  });

  it('maps non-contract error bodies to an HTTP_<status> code', () => {
    expect(toApiError(500, '<html>')).toMatchObject({ code: 'HTTP_500', status: 500 });
  });
});
