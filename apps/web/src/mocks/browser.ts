import { setupWorker } from 'msw/browser';
import { loadDb, saveDb } from './db';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// Persist mock state so a page reload doesn't log you out or undo your edits.
loadDb();
worker.events.on('response:mocked', () => saveDb());
