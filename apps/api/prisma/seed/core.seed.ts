import type { PrismaClient, RoleTag, StudyMode, LocationType } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as argon2 from 'argon2';

export interface CoreSeedResult {
  userIds: string[];
  subjectIds: string[];
  groupIds: string[];
}

const BUDAPEST_CENTER = { lat: 47.4979, lng: 19.0402 };

// The only subjects in the catalogue and the only ones test accounts take (first semester, BME VIK).
// Aliases are the names Neptun timetables use, so a connected Neptun calendar links to these.
const SUBJECTS_DATA = [
  { code: 'BME-CALC1', name: 'Calculus 1', aliases: ['Analízis 1 informatikusoknak', 'Analízis 1', 'Calculus 1 for Informaticians', 'Calculus I'] },
  {
    code: 'BME-ITC1',
    name: 'Introduction to Theory of Computing',
    aliases: ['Bevezetés a számításelméletbe 1', 'Bevezetés a számításelméletbe', 'Introduction to the Theory of Computing 1', 'Introduction to the Theory of Computing'],
  },
  { code: 'BME-DIGIT1', name: 'Digital Design', aliases: ['Digitális technika', 'Digitális technika 1', 'Digital Design 1'] },
  { code: 'BME-EE1', name: 'Basics of Electrical Engineering', aliases: ['Villamos alapismeretek', 'Basics of Electrical Engineering 1'] },
  { code: 'BME-PROG1', name: 'Basics of Programming', aliases: ['A programozás alapjai 1', 'A programozás alapjai', 'Basics of Programming 1'] },
];

// 25 Interest tags
const INTERESTS_DATA = [
  { slug: 'exam-prep', label: 'Exam prep' },
  { slug: 'homework-help', label: 'Homework help' },
  { slug: 'project-collab', label: 'Project collaboration' },
  { slug: 'silent-study', label: 'Silent study' },
  { slug: 'peer-tutoring', label: 'Peer tutoring' },
  { slug: 'hackathons', label: 'Hackathons' },
  { slug: 'competitive-programming', label: 'Competitive programming' },
  { slug: 'research', label: 'Academic research' },
  { slug: 'thesis-work', label: 'Thesis work' },
  { slug: 'morning-sessions', label: 'Morning sessions' },
  { slug: 'late-night-study', label: 'Late night study' },
  { slug: 'weekend-warriors', label: 'Weekend study' },
  { slug: 'coffee-shops', label: 'Coffee shop studying' },
  { slug: 'library-campers', label: 'Library study' },
  { slug: 'flashcards', label: 'Flashcards & Anki' },
  { slug: 'spaced-repetition', label: 'Spaced repetition' },
  { slug: 'feynman-technique', label: 'Feynman technique' },
  { slug: 'pomodoro', label: 'Pomodoro sessions' },
  { slug: 'past-papers', label: 'Past exam papers' },
  { slug: 'code-reviews', label: 'Code review buddies' },
  { slug: 'math-heavy', label: 'Math problem solving' },
  { slug: 'theory-discussion', label: 'Theory discussion' },
  { slug: 'lab-prep', label: 'Lab preparation' },
  { slug: 'language-exchange', label: 'Language exchange' },
  { slug: 'general-accountability', label: 'Accountability group' },
];

function randomBudapestCoord(maxRadiusKm = 8) {
  const angle = faker.number.float({ min: 0, max: 2 * Math.PI });
  const dist = faker.number.float({ min: 0.2, max: maxRadiusKm });
  const dLat = (dist / 111) * Math.cos(angle);
  const dLng = (dist / (111 * Math.cos((BUDAPEST_CENTER.lat * Math.PI) / 180))) * Math.sin(angle);
  return {
    lat: Math.round((BUDAPEST_CENTER.lat + dLat) * 1000) / 1000,
    lng: Math.round((BUDAPEST_CENTER.lng + dLng) * 1000) / 1000,
  };
}

export async function seedCore(prisma: PrismaClient): Promise<CoreSeedResult> {
  faker.seed(42);

  // 1. Clean previous seed data in relational order
  await prisma.swipe.deleteMany();
  await prisma.match.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.group.deleteMany();
  // test accounts only: real users keep their profile, interests and logins across re-seeds
  const seedOnly = { where: { user: { isSeed: true } } };
  await prisma.userSubject.deleteMany(seedOnly);
  await prisma.userInterest.deleteMany(seedOnly);
  await prisma.refreshToken.deleteMany(seedOnly);
  await prisma.preferences.deleteMany(seedOnly);
  await prisma.user.deleteMany({ where: { isSeed: true } });

  // 2. Seed Subjects (and drop every other subject, so the catalogue is exactly SUBJECTS_DATA)
  const createdSubjects = [];
  for (const s of SUBJECTS_DATA) {
    const subj = await prisma.subject.upsert({
      where: { code: s.code },
      update: { name: s.name, aliases: s.aliases },
      create: s,
    });
    createdSubjects.push(subj);
  }
  await prisma.subject.deleteMany({ where: { code: { notIn: SUBJECTS_DATA.map((s) => s.code) } } });
  const subjectIds = createdSubjects.map((s) => s.id);

  // 3. Seed Interests
  const createdInterests = [];
  for (const i of INTERESTS_DATA) {
    const interest = await prisma.interest.upsert({
      where: { slug: i.slug },
      update: { label: i.label },
      create: i,
    });
    createdInterests.push(interest);
  }

  // 4. Precompute password hash once (for performance)
  const passwordHash = await argon2.hash('password123');

  // 5. Create Demo User (demo@sgm.local)
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@sgm.local',
      passwordHash,
      displayName: 'Demo Student',
      bio: 'BME Computer Engineering student looking for study groups in Basics of Programming and Calculus 1.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
      university: 'Budapest University of Technology and Economics (BME)',
      faculty: 'Faculty of Electrical Engineering and Informatics (VIK)',
      homeLat: BUDAPEST_CENTER.lat,
      homeLng: BUDAPEST_CENTER.lng,
      homeLabel: 'BME Central Campus (Stoczek)',
      onboardingComplete: true,
      isSeed: true,
      preferences: {
        create: {
          groupSizeMin: 2,
          groupSizeMax: 4,
          maxDistanceKm: 7.5,
          sessionLengthMinutes: 90,
          mode: 'EITHER' as StudyMode,
          locationTypes: ['LIBRARY', 'CAMPUS_ROOM', 'CAFE'] as LocationType[],
        },
      },
    },
  });

  // Attach demo subjects (all five): Programming (CAN_EXPLAIN), Calculus (NEEDS_HELP), the rest PEER
  const progSubject = createdSubjects.find((s) => s.code === 'BME-PROG1')!;
  const calcSubject = createdSubjects.find((s) => s.code === 'BME-CALC1')!;
  const otherSubjects = createdSubjects.filter((s) => s !== progSubject && s !== calcSubject);

  await prisma.userSubject.createMany({
    data: [
      { userId: demoUser.id, subjectId: progSubject.id, role: 'CAN_EXPLAIN' as RoleTag, confidence: 5 },
      { userId: demoUser.id, subjectId: calcSubject.id, role: 'NEEDS_HELP' as RoleTag, confidence: 2 },
      ...otherSubjects.map((s) => ({ userId: demoUser.id, subjectId: s.id, role: 'PEER' as RoleTag, confidence: 3 })),
    ],
  });

  // Attach demo interests
  await prisma.userInterest.createMany({
    data: [
      { userId: demoUser.id, interestId: createdInterests[0].id }, // exam-prep
      { userId: demoUser.id, interestId: createdInterests[1].id }, // homework-help
      { userId: demoUser.id, interestId: createdInterests[3].id }, // silent-study
      { userId: demoUser.id, interestId: createdInterests[13].id }, // library-campers
    ],
  });

  // 6. Create 199 other seed users
  const userIds: string[] = [demoUser.id];
  const universities = [
    'Budapest University of Technology and Economics (BME)',
    'Eötvös Loránd University (ELTE)',
    'Corvinus University of Budapest',
    'Óbuda University',
  ];
  const faculties = ['VIK', 'IK', 'TTK', 'GTK', 'NIK', 'GPK'];
  const modes: StudyMode[] = ['IN_PERSON', 'ONLINE', 'EITHER'];
  const allLocationTypes: LocationType[] = ['LIBRARY', 'CAMPUS_ROOM', 'CAFE', 'COWORKING'];
  const roleTags: RoleTag[] = ['NEEDS_HELP', 'CAN_EXPLAIN', 'PEER'];

  for (let i = 1; i < 200; i++) {
    const coord = randomBudapestCoord(8);
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const displayName = `${firstName} ${lastName}`;
    const email = `student${i}@sgm.local`;

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        bio: faker.person.bio().substring(0, 280),
        avatarUrl: faker.image.avatar(),
        university: faker.helpers.arrayElement(universities),
        faculty: faker.helpers.arrayElement(faculties),
        homeLat: coord.lat,
        homeLng: coord.lng,
        homeLabel: `District ${faker.number.int({ min: 1, max: 22 })}, Budapest`,
        onboardingComplete: true,
        isSeed: true,
        preferences: {
          create: {
            groupSizeMin: 2,
            groupSizeMax: faker.number.int({ min: 3, max: 6 }),
            maxDistanceKm: faker.helpers.arrayElement([3, 5, 8, 10, 15]),
            sessionLengthMinutes: faker.helpers.arrayElement([60, 90, 120]),
            mode: faker.helpers.arrayElement(modes),
            locationTypes: faker.helpers.arrayElements(allLocationTypes, { min: 1, max: 3 }),
          },
        },
      },
    });

    userIds.push(user.id);

    // Pick 2-5 of the five subjects
    // Make sure the first 24 users share subjects with demoUser to guarantee great match scores
    const userSubjs = i < 25
      ? [progSubject, calcSubject, ...faker.helpers.arrayElements(otherSubjects, { min: 1, max: 2 })]
      : faker.helpers.arrayElements(createdSubjects, { min: 2, max: 5 });

    // Complementary role for the first 11 users: NEEDS_HELP in Programming (demo is CAN_EXPLAIN), CAN_EXPLAIN in Calc (demo is NEEDS_HELP)
    await prisma.userSubject.createMany({
      data: userSubjs.map((s) => {
        let role: RoleTag;
        if (i < 12 && s.id === progSubject.id) {
          role = 'NEEDS_HELP';
        } else if (i < 12 && s.id === calcSubject.id) {
          role = 'CAN_EXPLAIN';
        } else {
          role = faker.helpers.arrayElement(roleTags);
        }
        return {
          userId: user.id,
          subjectId: s.id,
          role,
          confidence: faker.number.int({ min: 1, max: 5 }),
        };
      }),
      skipDuplicates: true,
    });

    // Pick 2-6 random interests
    const userInterests = i < 15
      ? [createdInterests[0], createdInterests[1], ...faker.helpers.arrayElements(createdInterests, { min: 1, max: 3 })]
      : faker.helpers.arrayElements(createdInterests, { min: 2, max: 6 });

    await prisma.userInterest.createMany({
      data: userInterests.map((interest) => ({
        userId: user.id,
        interestId: interest.id,
      })),
      skipDuplicates: true,
    });
  }

  // 7. Seed 30 Groups
  const groupIds: string[] = [];
  // Group i studies createdSubjects[i % 5]: Calculus, Theory of Computing, Digital Design, Electrical Eng., Programming
  const groupNames = [
    'Calculus Problem Solvers',
    'Theory of Computing Proof Club',
    'Digital Design Lab Study',
    'Circuit Analysis Crew',
    'C Programming Cram Session',
    'Limits & Derivatives Drill',
    'Graphs & Combinatorics Pod',
    'Logic Gates Gang',
    'Electrical Engineering Exam Sprint',
    'Pointers & Linked Lists Pod',
    'Integrals Night Owls',
    'Number Theory Study Group',
    'Karnaugh Map Masters',
    'Kirchhoff Study Circle',
    'Programming Homework Help',
    'Calculus Midterm Rescue Team',
    'Theory of Computing Exam Prep',
    'Sequential Circuits Workshop',
    'EE Lab Report Writers',
    'Competitive Coders Budapest',
    'Sunday Morning Calculus Circle',
    'Proof Writing Practice',
    'Digital Design Exam Sprint',
    'Library Silence Squad (EE)',
    'Clean Code Beginners',
    'Series & Sequences Squad',
    'BSZ Practice Sheets',
    'State Machines Study Pod',
    'Basics of EE Peer Study',
    'BME Stoczek Coding Room',
  ];

  for (let i = 0; i < 30; i++) {
    const ownerId = userIds[i + 1]; // seed user
    const subj = createdSubjects[i % createdSubjects.length];
    const maxSize = faker.number.int({ min: 3, max: 6 });

    const group = await prisma.group.create({
      data: {
        name: groupNames[i],
        description: `Study group for ${subj.name} (${subj.code}). Meeting weekly in Budapest or online.`,
        subjectId: subj.id,
        maxSize,
        isOpen: true,
        members: {
          create: [
            {
              userId: ownerId,
              role: 'CAN_EXPLAIN' as RoleTag,
              isOwner: true,
            },
          ],
        },
      },
    });

    groupIds.push(group.id);

    // Add 1-3 additional members to the group
    const extraMembers = faker.helpers.arrayElements(
      userIds.slice(32, 100),
      { min: 1, max: Math.min(maxSize - 1, 3) },
    );

    for (const memberId of extraMembers) {
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: memberId,
          role: faker.helpers.arrayElement(roleTags),
          isOwner: false,
        },
      });
    }

    // Add planned session for some groups
    if (i % 2 === 0) {
      const start = new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000);
      start.setHours(14, 0, 0, 0);
      const end = new Date(start.getTime() + 90 * 60 * 1000);

      await prisma.studySession.create({
        data: {
          groupId: group.id,
          start,
          end,
          status: 'PLANNED',
        },
      });
    }
  }

  // 8. Seed Swipes and Matches
  // Create guaranteed matches for demo user with users 1, 2, 3 in Programming and Calculus
  const demoMatchPartner1 = userIds[1];
  const demoMatchPartner2 = userIds[2];

  // Swipes for demo user and partner 1 on Programming
  await prisma.swipe.createMany({
    data: [
      { swiperId: demoUser.id, targetKind: 'user', targetId: demoMatchPartner1, subjectId: progSubject.id, direction: 'LIKE' },
      { swiperId: demoMatchPartner1, targetKind: 'user', targetId: demoUser.id, subjectId: progSubject.id, direction: 'LIKE' },
    ],
  });

  // Mutual match creates a group and match record
  const matchGroup1 = await prisma.group.create({
    data: {
      name: `${demoUser.displayName} & Partner Study Pod`,
      subjectId: progSubject.id,
      maxSize: 4,
      isOpen: true,
      members: {
        create: [
          { userId: demoUser.id, role: 'CAN_EXPLAIN', isOwner: true },
          { userId: demoMatchPartner1, role: 'NEEDS_HELP', isOwner: false },
        ],
      },
    },
  });

  await prisma.match.create({
    data: {
      groupId: matchGroup1.id,
      subjectId: progSubject.id,
      userAId: demoUser.id,
      userBId: demoMatchPartner1,
    },
  });

  // Swipes for demo user and partner 2 on Calculus
  await prisma.swipe.createMany({
    data: [
      { swiperId: demoUser.id, targetKind: 'user', targetId: demoMatchPartner2, subjectId: calcSubject.id, direction: 'LIKE' },
      { swiperId: demoMatchPartner2, targetKind: 'user', targetId: demoUser.id, subjectId: calcSubject.id, direction: 'LIKE' },
    ],
  });

  const matchGroup2 = await prisma.group.create({
    data: {
      name: `Calculus Match Group`,
      subjectId: calcSubject.id,
      maxSize: 4,
      isOpen: true,
      members: {
        create: [
          { userId: demoMatchPartner2, role: 'CAN_EXPLAIN', isOwner: true },
          { userId: demoUser.id, role: 'NEEDS_HELP', isOwner: false },
        ],
      },
    },
  });

  await prisma.match.create({
    data: {
      groupId: matchGroup2.id,
      subjectId: calcSubject.id,
      userAId: demoMatchPartner2,
      userBId: demoUser.id,
    },
  });

  // Seed 10 other mutual matches between seed users
  for (let m = 3; m < 13; m++) {
    const userA = userIds[m * 2];
    const userB = userIds[m * 2 + 1];
    const subj = createdSubjects[m % createdSubjects.length];

    await prisma.swipe.createMany({
      data: [
        { swiperId: userA, targetKind: 'user', targetId: userB, subjectId: subj.id, direction: 'LIKE' },
        { swiperId: userB, targetKind: 'user', targetId: userA, subjectId: subj.id, direction: 'LIKE' },
      ],
      skipDuplicates: true,
    });

    const mGroup = await prisma.group.create({
      data: {
        name: `${subj.name} Study Pair`,
        subjectId: subj.id,
        maxSize: 4,
        isOpen: true,
        members: {
          create: [
            { userId: userA, role: 'PEER', isOwner: true },
            { userId: userB, role: 'PEER', isOwner: false },
          ],
        },
      },
    });

    await prisma.match.create({
      data: {
        groupId: mGroup.id,
        subjectId: subj.id,
        userAId: userA,
        userBId: userB,
      },
    });
  }

  // Pending likes: top-ranked classmates (complementary roles, users 3–14) already liked the demo user in
  // Programming and Calculus, so swiping right on them in the deck produces the "It's a match!" moment.
  // (The matches above are already complete, so without these the demo deck never matches.)
  await prisma.swipe.createMany({
    data: userIds.slice(3, 15).flatMap((swiperId) =>
      [progSubject.id, calcSubject.id].map((subjectId) => ({
        swiperId,
        targetKind: 'user',
        targetId: demoUser.id,
        subjectId,
        direction: 'LIKE' as const,
      })),
    ),
    skipDuplicates: true,
  });

  return {
    userIds,
    subjectIds,
    groupIds,
  };
}
