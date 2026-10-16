import { authHandlers } from './auth';
import { profileHandlers } from './profile';
import { systemHandlers } from './system';

/** One array per contract tag; new tickets add their own file here. */
export const handlers = [...systemHandlers, ...authHandlers, ...profileHandlers];
