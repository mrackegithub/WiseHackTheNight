/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(dir, '../.env');
if (existsSync(envFile)) {
  const content = readFileSync(envFile, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import { buildApp } from '../src/app.js';

async function runVerification() {
  console.log('--- Starting Live API & Contract Verification ---');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));

  const app = await buildApp();
  await app.ready();

  const results: Record<string, any> = {};

  try {
    // 1. GET /api/v1/health
    console.log('\n[1] Testing GET /api/v1/health...');
    const healthRes = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });
    console.log(`Status: ${healthRes.statusCode}, Body: ${healthRes.body}`);
    const healthData = healthRes.json();
    if (healthRes.statusCode !== 200 || healthData.status !== 'ok') {
      throw new Error(`Health check failed: status=${healthRes.statusCode}, body=${healthRes.body}`);
    }
    results.health = { statusCode: healthRes.statusCode, status: healthData.status, version: healthData.version };

    // 2. POST /api/v1/auth/login
    console.log('\n[2] Testing POST /api/v1/auth/login...');
    let loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'demo@sgm.local',
        password: 'password123',
      },
    });
    console.log(`Status: ${loginRes.statusCode}`);
    let loginData = loginRes.json();

    if (loginRes.statusCode !== 200) {
      console.warn(`Initial login failed with ${loginRes.statusCode}: ${loginRes.body}`);
      console.log('Attempting clean seed...');
      const { seedCore } = await import('../prisma/seed/core.seed.js');
      const { seedIntegrations } = await import('../prisma/seed/integrations.seed.js');
      const core = await seedCore(app.prisma);
      await seedIntegrations(app.prisma, core);
      console.log('Seed completed. Retrying login...');

      loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'demo@sgm.local',
          password: 'password123',
        },
      });
      loginData = loginRes.json();
    }

    if (loginRes.statusCode !== 200 || !loginData.accessToken) {
      throw new Error(`Login failed: status=${loginRes.statusCode}, body=${loginRes.body}`);
    }
    const token = loginData.accessToken;
    console.log('Successfully logged in as demo@sgm.local. Access token obtained.');
    results.login = { statusCode: loginRes.statusCode, hasAccessToken: !!token, userEmail: loginData.user?.email };

    const authHeaders = { authorization: `Bearer ${token}` };

    // 3. GET /api/v1/me and subjects
    console.log('\n[3] Testing GET /api/v1/me and subjects...');
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: authHeaders,
    });
    console.log(`GET /api/v1/me -> Status: ${meRes.statusCode}`);
    const meData = meRes.json();
    console.log('meData:', JSON.stringify({ displayName: meData.displayName, onboardingComplete: meData.onboardingComplete, interestsCount: meData.interests?.length }));

    const meSubjectsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me/subjects',
      headers: authHeaders,
    });
    console.log(`GET /api/v1/me/subjects -> Status: ${meSubjectsRes.statusCode}`);
    const meSubjectsData = meSubjectsRes.json();
    console.log(`Demo user subjects count: ${meSubjectsData.length}`);

    const allSubjectsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/subjects',
      headers: authHeaders,
    });
    console.log(`GET /api/v1/subjects -> Status: ${allSubjectsRes.statusCode}`);
    const allSubjectsData = allSubjectsRes.json();
    console.log(`All subjects count: ${allSubjectsData.items?.length}`);

    if (meData.onboardingComplete !== true) {
      throw new Error(`Expected onboardingComplete === true, got ${meData.onboardingComplete}`);
    }
    if (meSubjectsData.length !== 8) {
      throw new Error(`Expected 8 subjects for demo user, got ${meSubjectsData.length}`);
    }
    results.me = {
      onboardingComplete: meData.onboardingComplete,
      mySubjectsCount: meSubjectsData.length,
      allSubjectsCount: allSubjectsData.items?.length,
      subjects: meSubjectsData.map((s: any) => ({ code: s.subject.code, name: s.subject.name, role: s.role })),
    };

    // 4. GET /api/v1/me/availability/windows
    console.log('\n[4] Testing GET /api/v1/me/availability/windows...');
    const windowsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me/availability/windows',
      headers: authHeaders,
    });
    console.log(`Status: ${windowsRes.statusCode}`);
    const windowsData = windowsRes.json();
    console.log(`Availability windows count: ${Array.isArray(windowsData) ? windowsData.length : 'not array'}`);
    if (windowsRes.statusCode !== 200 || !Array.isArray(windowsData) || windowsData.length === 0) {
      throw new Error(`Availability windows check failed: ${windowsRes.body}`);
    }
    results.availabilityWindows = {
      statusCode: windowsRes.statusCode,
      windowsCount: windowsData.length,
      windows: windowsData,
    };

    // 5. GET /api/v1/me/schedule?from=2026-10-19T00:00:00Z&to=2026-10-26T00:00:00Z
    console.log('\n[5] Testing GET /api/v1/me/schedule?from=2026-10-19T00:00:00Z&to=2026-10-26T00:00:00Z...');
    const scheduleRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me/schedule?from=2026-10-19T00:00:00Z&to=2026-10-26T00:00:00Z',
      headers: authHeaders,
    });
    console.log(`Status: ${scheduleRes.statusCode}`);
    const scheduleData = scheduleRes.json();
    console.log(`Schedule events count: ${Array.isArray(scheduleData) ? scheduleData.length : 'not array'}`);

    if (scheduleRes.statusCode !== 200 || !Array.isArray(scheduleData)) {
      throw new Error(`Schedule check failed: ${scheduleRes.body}`);
    }

    // Check for overlapping course clashes
    const courseEvents = scheduleData.filter((e: any) => e.source === 'NEPTUN');
    console.log(`Neptun course events in range: ${courseEvents.length}`);

    let courseClashes = 0;
    const clashesDetails: any[] = [];
    for (let i = 0; i < courseEvents.length; i++) {
      for (let j = i + 1; j < courseEvents.length; j++) {
        const e1 = courseEvents[i];
        const e2 = courseEvents[j];
        const s1 = new Date(e1.start).getTime();
        const e1End = new Date(e1.end).getTime();
        const s2 = new Date(e2.start).getTime();
        const e2End = new Date(e2.end).getTime();

        if (s1 < e2End && s2 < e1End) {
          courseClashes++;
          clashesDetails.push({ e1: { title: e1.title, start: e1.start, end: e1.end }, e2: { title: e2.title, start: e2.start, end: e2.end } });
        }
      }
    }
    console.log(`Course clashes detected: ${courseClashes}`);
    if (courseClashes > 0) {
      console.warn('Clash details:', JSON.stringify(clashesDetails, null, 2));
    }
    results.schedule = {
      statusCode: scheduleRes.statusCode,
      totalEvents: scheduleData.length,
      courseEventsCount: courseEvents.length,
      courseClashes,
      clashesDetails,
    };

    // 6. GET /api/v1/matching/candidates
    console.log('\n[6] Testing GET /api/v1/matching/candidates...');
    // Demo user has BME-PROG1 and BME-CALC1 as primary subjects
    const progSubject = meSubjectsData.find((s: any) => s.subject.code === 'BME-PROG1')?.subject ?? meSubjectsData[0].subject;
    console.log(`Querying candidates for subject: ${progSubject.code} (${progSubject.id})...`);

    const candidatesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/matching/candidates?subjectId=${progSubject.id}`,
      headers: authHeaders,
    });
    console.log(`Status: ${candidatesRes.statusCode}`);
    const candidatesData = candidatesRes.json();
    console.log(`Candidates count: ${Array.isArray(candidatesData) ? candidatesData.length : 'not array'}`);
    if (candidatesRes.statusCode !== 200 || !Array.isArray(candidatesData) || candidatesData.length === 0) {
      throw new Error(`Matching candidates check failed: status=${candidatesRes.statusCode}, body=${candidatesRes.body}`);
    }

    const topCandidate = candidatesData[0];
    console.log('Top candidate:', {
      id: topCandidate.id,
      name: topCandidate.displayName,
      score: topCandidate.score,
      scoreBreakdown: topCandidate.scoreBreakdown,
      sharedSlotsCount: topCandidate.sharedSlots?.length,
    });

    results.matching = {
      statusCode: candidatesRes.statusCode,
      subjectQueried: { code: progSubject.code, name: progSubject.name },
      candidatesCount: candidatesData.length,
      topCandidate: {
        id: topCandidate.id,
        name: topCandidate.displayName,
        score: topCandidate.score,
        sharedSlotsCount: topCandidate.sharedSlots?.length,
      },
    };

    // 7. GET /api/v1/groups
    console.log('\n[7] Testing GET /api/v1/groups...');
    const groupsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
      headers: authHeaders,
    });
    console.log(`Status: ${groupsRes.statusCode}`);
    const groupsData = groupsRes.json();
    console.log(`Groups count: ${Array.isArray(groupsData) ? groupsData.length : 'not array'}`);
    if (groupsRes.statusCode !== 200 || !Array.isArray(groupsData) || groupsData.length === 0) {
      throw new Error(`Groups check failed: status=${groupsRes.statusCode}, body=${groupsRes.body}`);
    }

    // For each group, check sessions and booked rooms
    const groupsWithSessions: any[] = [];
    let totalSessionsWithRooms = 0;
    for (const group of groupsData) {
      const sessRes = await app.inject({
        method: 'GET',
        url: `/api/v1/groups/${group.id}/sessions`,
        headers: authHeaders,
      });
      const sessions = sessRes.json();
      const sessionsArr = Array.isArray(sessions) ? sessions : [];
      const withRooms = sessionsArr.filter((s: any) => s.bookingId || s.location?.bookable);
      totalSessionsWithRooms += withRooms.length;

      groupsWithSessions.push({
        id: group.id,
        name: group.name,
        subject: group.subject?.name,
        nextSessionAt: group.nextSessionAt,
        sessionsCount: sessionsArr.length,
        sessions: sessionsArr.map((s: any) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          locationName: s.location?.name,
          bookingId: s.bookingId,
          status: s.status,
        })),
      });
    }
    console.log(`Groups with sessions checked: ${groupsWithSessions.length}, total sessions with rooms: ${totalSessionsWithRooms}`);
    results.groups = {
      statusCode: groupsRes.statusCode,
      groupsCount: groupsData.length,
      totalSessionsWithRooms,
      groups: groupsWithSessions,
    };

    // 8. GET /api/v1/locations
    console.log('\n[8] Testing GET /api/v1/locations...');
    const locationsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/locations',
      headers: authHeaders,
    });
    console.log(`Status: ${locationsRes.statusCode}`);
    const locationsData = locationsRes.json();
    console.log(`Locations count: ${Array.isArray(locationsData) ? locationsData.length : 'not array'}`);
    if (locationsRes.statusCode !== 200 || !Array.isArray(locationsData) || locationsData.length !== 25) {
      throw new Error(`Expected 25 locations, got ${Array.isArray(locationsData) ? locationsData.length : locationsRes.body}`);
    }
    results.locations = {
      statusCode: locationsRes.statusCode,
      locationsCount: locationsData.length,
      sampleLocations: locationsData.slice(0, 3).map((l: any) => ({ id: l.id, name: l.name, type: l.type, bookable: l.bookable })),
    };

    console.log('\n========================================');
    console.log('--- ALL 8 VERIFICATION CHECKS PASSED ---');
    console.log('========================================');
    console.log(JSON.stringify(results, null, 2));

    return results;
  } finally {
    await app.close();
  }
}

runVerification()
  .then(() => {
    console.log('\nLIVE API VERIFICATION COMPLETE - SUCCESS!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nLIVE API VERIFICATION FAILED:', err);
    process.exit(1);
  });
