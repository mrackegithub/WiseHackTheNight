import { describe, expect, it } from 'vitest';
import { DEMO_USER_ID, db, issueTokens, loadDb, resetDb, saveDb } from './db';

describe('mock db persistence', () => {
  it('round-trips Maps through localStorage', () => {
    const { accessToken } = issueTokens(DEMO_USER_ID);
    saveDb();
    resetDb();
    expect(db.accessTokens.has(accessToken)).toBe(false);

    loadDb();
    expect(db.accessTokens.get(accessToken)).toBe(DEMO_USER_ID);
    expect(db.users.get(DEMO_USER_ID)?.me.displayName).toBe('Demo Student');
  });

  it('keeps issuing unique tokens after a reload', () => {
    const first = issueTokens(DEMO_USER_ID);
    saveDb();
    loadDb();
    expect(issueTokens(DEMO_USER_ID).accessToken).not.toBe(first.accessToken);
  });
});
