const https = require('https');

async function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  const baseUrl = 'https://wisehackthenight.vercel.app/api/v1';

  console.log('--- 1. Health check ---');
  const health = await request(`${baseUrl}/health`);
  console.log('Health status:', health.status, health.body);

  console.log('\n--- 2. Login demo@sgm.local ---');
  const login = await request(
    `${baseUrl}/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'demo@sgm.local', password: 'password123' },
  );
  console.log('Login status:', login.status, 'User:', login.body.user?.displayName);
  const token = login.body.accessToken;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  console.log('\n--- 3. Fetch /me and /me/subjects ---');
  const me = await request(`${baseUrl}/me`, { headers: authHeaders });
  console.log('Me status:', me.status, 'ID:', me.body.id, 'Name:', me.body.displayName);
  const subjectsRes = await request(`${baseUrl}/me/subjects`, { headers: authHeaders });
  console.log('Subjects status:', subjectsRes.status, 'Count:', Array.isArray(subjectsRes.body) ? subjectsRes.body.length : 0);
  const firstSubjId = subjectsRes.body?.[0]?.subject?.id || subjectsRes.body?.[0]?.id;
  console.log('Using subject ID:', firstSubjId);

  console.log('\n--- 4. Self-swipe invariant test (must return 422 VALIDATION_FAILED) ---');
  const selfSwipe = await request(
    `${baseUrl}/matching/swipes`,
    {
      method: 'POST',
      headers: authHeaders,
    },
    {
      targetKind: 'user',
      targetId: me.body.id,
      subjectId: firstSubjId,
      direction: 'LIKE',
    },
  );
  console.log('Self-swipe HTTP Status:', selfSwipe.status, 'Response:', selfSwipe.body);

  console.log('\n--- 5. Swiping on already-joined group test (must return 409 ALREADY_MEMBER) ---');
  const groupsRes = await request(`${baseUrl}/groups`, { headers: authHeaders });
  const groupsList = Array.isArray(groupsRes.body) ? groupsRes.body : (groupsRes.body.items || []);
  console.log('Groups count:', groupsList.length);
  const myGroup = groupsList[0];
  if (myGroup) {
    console.log(`Testing swipe on already joined group: "${myGroup.name}" (${myGroup.id})`);
    const groupSwipe = await request(
      `${baseUrl}/matching/swipes`,
      {
        method: 'POST',
        headers: authHeaders,
      },
      {
        targetKind: 'group',
        targetId: myGroup.id,
        subjectId: myGroup.subject?.id || firstSubjId,
        direction: 'LIKE',
      },
    );
    console.log('Own group swipe HTTP Status:', groupSwipe.status, 'Response:', groupSwipe.body);
  }

  console.log('\n--- 5b. Swiping on user already in group for that subject (must return 409 ALREADY_MATCHED) ---');
  if (myGroup) {
    const groupDetail = await request(`${baseUrl}/groups/${myGroup.id}`, { headers: authHeaders });
    const otherMember = groupDetail.body.members?.find((m) => m.user?.id !== me.body.id);
    if (otherMember) {
      console.log(`Testing swipe on groupmate: "${otherMember.user.displayName}" (${otherMember.user.id}) for subject ${myGroup.subject?.name}`);
      const userSwipe = await request(
        `${baseUrl}/matching/swipes`,
        {
          method: 'POST',
          headers: authHeaders,
        },
        {
          targetKind: 'user',
          targetId: otherMember.user.id,
          subjectId: myGroup.subject.id,
          direction: 'LIKE',
        },
      );
      console.log('Shared groupmate swipe HTTP Status:', userSwipe.status, 'Response:', userSwipe.body);
    }
  }

  console.log('\n--- 6. Calendar busy time collision test (must return 409 EVENT_CONFLICT) ---');
  const scheduleRes = await request(
    `${baseUrl}/me/schedule?from=2026-10-19T00:00:00.000Z&to=2026-10-26T00:00:00.000Z`,
    { headers: authHeaders },
  );
  console.log('Schedule events found:', scheduleRes.body.length || scheduleRes.body.events?.length);
  const events = Array.isArray(scheduleRes.body) ? scheduleRes.body : (scheduleRes.body.events || []);
  const firstEvent = events[0];
  if (firstEvent) {
    console.log(`Testing collision with event: "${firstEvent.title}" (${firstEvent.start} - ${firstEvent.end})`);
    const busyConflict = await request(
      `${baseUrl}/me/schedule`,
      {
        method: 'POST',
        headers: authHeaders,
      },
      {
        title: 'Collision Test Busy Block',
        start: firstEvent.start,
        end: firstEvent.end,
        repeatWeeks: 0,
      },
    );
    console.log('Collision test HTTP Status:', busyConflict.status, 'Response:', busyConflict.body);
  }

  console.log('\n--- 7. Non-conflicting busy time creation test ---');
  // Free slot on Sunday night
  const nonConflictingBusy = await request(
    `${baseUrl}/me/schedule`,
    {
      method: 'POST',
      headers: authHeaders,
    },
    {
      title: 'Valid Sunday Evening Study',
      start: '2026-10-25T21:00:00.000Z',
      end: '2026-10-25T22:00:00.000Z',
      repeatWeeks: 0,
    },
  );
  console.log('Valid busy block HTTP Status:', nonConflictingBusy.status, 'Response:', nonConflictingBusy.body);

  console.log('\n=== All live verification tests completed! ===');
}

run().catch(console.error);
