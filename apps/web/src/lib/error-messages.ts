import { ApiError } from '../api/errors';

/**
 * User-facing text for an error. Switches on the contract's stable `Error.code` (see `Error` in
 * contracts/openapi.yaml), never on `message`. `NETWORK_ERROR` is client-side only.
 * Status-specific cases (e.g. 401 on login) are handled by the page itself with `meta: { silent: true }`.
 */
export function messageForError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';

  switch (error.code) {
    case 'NETWORK_ERROR':
      return "Can't reach the server. Check your connection and try again.";
    case 'UNAUTHORIZED':
      return 'Your session has expired. Please log in again.';
    case 'VALIDATION_FAILED':
      return error.details.length > 0
        ? `Please check: ${error.details.map((d) => d.path ?? d.issue).join(', ')}`
        : 'Some fields are invalid. Please check the form.';
    case 'NOT_FOUND':
      return "We couldn't find what you were looking for.";
    case 'GROUP_FULL':
      return 'This group is already full.';
    case 'SLOT_TAKEN':
      return 'That room was just booked by someone else. Pick another slot or room.';
    case 'NEPTUN_UNREACHABLE':
      return "Couldn't reach Neptun. Check your calendar link or try again later.";
    default:
      return error.message || 'Something went wrong. Please try again.';
  }
}
