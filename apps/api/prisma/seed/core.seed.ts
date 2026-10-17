import type { PrismaClient, RoleTag, StudyMode, LocationType } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as argon2 from 'argon2';

export interface CoreSeedResult {
  userIds: string[];
  subjectIds: string[];
  groupIds: string[];
}

const BUDAPEST_CENTER = { lat: 47.4979, lng: 19.0402 };

// 40 Realistic university subjects (BME / ELTE style)
const SUBJECTS_DATA = [
  { code: 'IP-18AA1E', name: 'Algorithms and Data Structures I', credits: 5 },
  { code: 'IP-18AA2E', name: 'Algorithms and Data Structures II', credits: 5 },
  { code: 'IP-18PROGE', name: 'Programming Languages (C++)', credits: 6 },
  { code: 'IP-18PROG2E', name: 'Object-Oriented Programming (Java)', credits: 6 },
  { code: 'IP-18WEBE', name: 'Web Development', credits: 4 },
  { code: 'IP-18DB1E', name: 'Database Systems I', credits: 5 },
  { code: 'IP-18DB2E', name: 'Database Systems II', credits: 4 },
  { code: 'IP-18OS1E', name: 'Operating Systems', credits: 5 },
  { code: 'IP-18NET1E', name: 'Computer Networks', credits: 4 },
  { code: 'IP-18AIE', name: 'Artificial Intelligence Foundations', credits: 5 },
  { code: 'IP-18MLE', name: 'Machine Learning', credits: 6 },
  { code: 'IP-18SE1E', name: 'Software Engineering', credits: 5 },
  { code: 'IP-18COMP1E', name: 'Theory of Computation', credits: 5 },
  { code: 'IP-18LOGE', name: 'Mathematical Logic in Computer Science', credits: 4 },
  { code: 'BMETE90AX00', name: 'Calculus I', credits: 6 },
  { code: 'BMETE90AX02', name: 'Calculus II', credits: 6 },
  { code: 'BMETE90AX21', name: 'Linear Algebra', credits: 4 },
  { code: 'BMETE90AX22', name: 'Probability and Statistics', credits: 4 },
  { code: 'BMETE90AX23', name: 'Discrete Mathematics I', credits: 5 },
  { code: 'BMETE90AX24', name: 'Discrete Mathematics II', credits: 5 },
  { code: 'BMEVIAUA000', name: 'Digital Design and Microcontrollers', credits: 5 },
  { code: 'BMEVIAUA001', name: 'Signals and Systems', credits: 5 },
  { code: 'BMEVIAUA002', name: 'Computer Architecture', credits: 4 },
  { code: 'BMEVITMA001', name: 'Distributed Systems', credits: 5 },
  { code: 'BMEVITMA002', name: 'Cloud Computing and Microservices', credits: 4 },
  { code: 'BMEVITMA003', name: 'Mobile Application Development', credits: 4 },
  { code: 'BMEVITMA004', name: 'Cybersecurity Principles', credits: 5 },
  { code: 'BMEVITMA005', name: 'Cryptography', credits: 4 },
  { code: 'BMEGT41A001', name: 'Microeconomics', credits: 3 },
  { code: 'BMEGT41A002', name: 'Management and Business Economics', credits: 3 },
  { code: 'BMEGT43A001', name: 'Project Management', credits: 3 },
  { code: 'BMEGT43A002', name: 'Engineering Ethics and Law', credits: 2 },
  { code: 'ELTE-FIZ1', name: 'Mechanics and Thermodynamics', credits: 5 },
  { code: 'ELTE-FIZ2', name: 'Electromagnetism and Optics', credits: 5 },
  { code: 'ELTE-BIO1', name: 'Bioinformatics Fundamentals', credits: 4 },
  { code: 'ELTE-NUM1', name: 'Numerical Analysis', credits: 4 },
  { code: 'ELTE-GRAF1', name: 'Graph Theory Applications', credits: 4 },
  { code: 'CORV-FIN1', name: 'Corporate Finance for Engineers', credits: 3 },
  { code: 'CORV-DATA1', name: 'Data Visualization and Business Intelligence', credits: 4 },
  { code: 'CORV-ENT1', name: 'Tech Entrepreneurship', credits: 3 },
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
  await prisma.userSubject.deleteMany();
  await prisma.userInterest.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.preferences.deleteMany();
  await prisma.user.deleteMany({ where: { isSeed: true } });

  // 2. Seed Subjects
  const createdSubjects = [];
  for (const s of SUBJECTS_DATA) {
    const subj = await prisma.subject.upsert({
      where: { code: s.code },
      update: { name: s.name, credits: s.credits },
      create: s,
    });
    createdSubjects.push(subj);
  }
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
      bio: 'BME Computer Science student looking for study groups in Algorithms and Calculus.',
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

  // Attach demo subjects: Algorithms (CAN_EXPLAIN) & Calculus (NEEDS_HELP)
  const algoSubject = createdSubjects.find((s) => s.code === 'IP-18AA1E')!;
  const calcSubject = createdSubjects.find((s) => s.code === 'BMETE90AX00')!;
  const dbSubject = createdSubjects.find((s) => s.code === 'IP-18DB1E')!;

  await prisma.userSubject.createMany({
    data: [
      { userId: demoUser.id, subjectId: algoSubject.id, role: 'CAN_EXPLAIN' as RoleTag, confidence: 5 },
      { userId: demoUser.id, subjectId: calcSubject.id, role: 'NEEDS_HELP' as RoleTag, confidence: 2 },
      { userId: demoUser.id, subjectId: dbSubject.id, role: 'PEER' as RoleTag, confidence: 3 },
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

    // Pick 2-5 random subjects
    // Make sure the first 20 users share subjects with demoUser to guarantee great match scores
    const userSubjs = i < 25
      ? [algoSubject, calcSubject, ...faker.helpers.arrayElements(createdSubjects, { min: 1, max: 2 })]
      : faker.helpers.arrayElements(createdSubjects, { min: 2, max: 5 });

    // Complementary role for the first 10 users: NEEDS_HELP in Algo (demo is CAN_EXPLAIN), CAN_EXPLAIN in Calc (demo is NEEDS_HELP)
    await prisma.userSubject.createMany({
      data: userSubjs.map((s) => {
        let role: RoleTag;
        if (i < 12 && s.id === algoSubject.id) {
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
  const groupNames = [
    'Algorithms Cram Session',
    'Data Structures Study Pod',
    'Calculus Problem Solvers',
    'Web Dev Hackers',
    'Distributed Systems Crew',
    'AI / ML Paper Club',
    'Database Optimizers',
    'Operating Systems Kernel Gang',
    'Discrete Math Working Group',
    'Linear Algebra Study Group',
    'Signals & Systems Prep',
    'Digital Design Lab Study',
    'Networks & Protocols',
    'BME VIK Exam Sprint',
    'ELTE CS Peer Study',
    'Corvinus Data Analytics Pod',
    'Software Architecture Discussion',
    'Sunday Morning Study Circle',
    'Night Owls Study Group',
    'Library Silence Squad',
    'Calculus II Rescue Team',
    'Compiler & Automata Crew',
    'BME Stoczek Study Room',
    'Clean Code & Best Practices',
    'Cybersecurity CTF Team',
    'Cloud Native Builders',
    'Mobile Dev Project Pod',
    'Probability Theory Study',
    'Microeconomics Reviewers',
    'Competitive Coders Budapest',
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
  // Create guaranteed matches for demo user with users 1, 2, 3 in Algorithms and Calculus
  const demoMatchPartner1 = userIds[1];
  const demoMatchPartner2 = userIds[2];

  // Swipes for demo user and partner 1 on Algorithms
  await prisma.swipe.createMany({
    data: [
      { swiperId: demoUser.id, targetKind: 'user', targetId: demoMatchPartner1, subjectId: algoSubject.id, direction: 'LIKE' },
      { swiperId: demoMatchPartner1, targetKind: 'user', targetId: demoUser.id, subjectId: algoSubject.id, direction: 'LIKE' },
    ],
  });

  // Mutual match creates a group and match record
  const matchGroup1 = await prisma.group.create({
    data: {
      name: `${demoUser.displayName} & Partner Study Pod`,
      subjectId: algoSubject.id,
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
      subjectId: algoSubject.id,
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
  // Algorithms and Calculus, so swiping right on them in the deck produces the "It's a match!" moment.
  // (The matches above are already complete, so without these the demo deck never matches.)
  await prisma.swipe.createMany({
    data: userIds.slice(3, 15).flatMap((swiperId) =>
      [algoSubject.id, calcSubject.id].map((subjectId) => ({
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
