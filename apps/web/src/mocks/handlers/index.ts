import { authHandlers } from './auth';
import { locationHandlers } from './locations';
import { profileHandlers } from './profile';
import { subjectHandlers } from './subjects';
import { systemHandlers } from './system';

/** One array per contract tag; new tickets add their own file here. */
export const handlers = [...systemHandlers, ...authHandlers, ...profileHandlers, ...subjectHandlers, ...locationHandlers];
