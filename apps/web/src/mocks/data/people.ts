import type { Schemas } from '@sgm/contracts';
import { interests } from './interests';
import { subjects } from './subjects';

/** A seeded classmate the demo user can swipe on. */
export interface MockPerson {
  user: Schemas['PublicUser'];
  location: { lat: number; lng: number };
  interestIds: string[];
  subjects: { subjectId: string; role: Schemas['RoleTag'] }[];
  /** Already liked the demo user, so a LIKE back is a mutual match. */
  likesYou: boolean;
}

const ALGO = subjects[0].id; // Algorithms and Data Structures I
const DB = subjects[8].id; // Databases I
const ANA = subjects[15].id; // Analysis I

type Row = [name: string, faculty: string, bio: string, lat: number, lng: number, interestIdx: number[], subjects: [string, Schemas['RoleTag']][], likesYou?: boolean];

const rows: Row[] = [
  ['Anna Kovács', 'Faculty of Informatics', 'Loves graph algorithms and whiteboards.', 47.4741, 19.0596, [0, 3, 22], [[ALGO, 'NEEDS_HELP'], [ANA, 'PEER']], true],
  ['Bence Nagy', 'Faculty of Informatics', 'Competitive programmer, ICPC regional 2025.', 47.4812, 19.0558, [3, 4, 24], [[ALGO, 'CAN_EXPLAIN'], [DB, 'PEER']]],
  ['Csilla Tóth', 'Faculty of Science', 'Maths minor, explains proofs patiently.', 47.4897, 19.0614, [12, 13, 21], [[ANA, 'CAN_EXPLAIN'], [ALGO, 'PEER']], true],
  ['Dániel Szabó', 'Faculty of Informatics', 'Backend dev on the side. Postgres fan.', 47.4979, 19.0545, [6, 10, 23], [[DB, 'CAN_EXPLAIN']]],
  ['Eszter Horváth', 'Faculty of Informatics', 'First time doing Analysis, need a buddy.', 47.4771, 19.0478, [0, 1, 20], [[ANA, 'NEEDS_HELP'], [DB, 'NEEDS_HELP']]],
  ['Ferenc Varga', 'Faculty of Informatics', 'Prefers quiet library sessions.', 47.5052, 19.0632, [21, 0], [[ALGO, 'PEER'], [ANA, 'PEER']]],
  ['Gréta Kiss', 'Faculty of Informatics', 'Night owl, coffee-fuelled exam prep.', 47.4944, 19.0617, [0, 23, 24], [[ALGO, 'NEEDS_HELP']], true],
  ['Hunor Molnár', 'Faculty of Science', 'Physics student taking CS courses.', 47.4725, 19.0622, [12, 16], [[ANA, 'CAN_EXPLAIN'], [ALGO, 'NEEDS_HELP']]],
  ['Ildikó Németh', 'Faculty of Informatics', 'Data science enthusiast.', 47.4867, 19.0587, [9, 10, 2], [[DB, 'PEER'], [ALGO, 'PEER']]],
  ['János Farkas', 'Faculty of Informatics', 'Erasmus student, studying in English.', 47.5103, 19.0567, [18, 4, 2], [[DB, 'NEEDS_HELP'], [ANA, 'NEEDS_HELP']], true],
  ['Kata Balogh', 'Faculty of Informatics', 'Web dev, likes explaining SQL joins.', 47.4813, 19.0702, [6, 22, 1], [[DB, 'CAN_EXPLAIN'], [ALGO, 'PEER']]],
  ['Levente Papp', 'Faculty of Informatics', 'Pomodoro or nothing.', 47.4612, 19.0207, [20, 0], [[ANA, 'PEER'], [DB, 'PEER']]],
  ['Mira Lakatos', 'Faculty of Informatics', 'Security / CTF team member.', 47.5004, 19.0838, [11, 4], [[ALGO, 'CAN_EXPLAIN'], [DB, 'NEEDS_HELP']]],
  ['Nándor Takács', 'Faculty of Informatics', 'Thesis year, revising the basics.', 47.4683, 19.0571, [17, 0], [[ANA, 'NEEDS_HELP']]],
  ['Orsolya Juhász', 'Faculty of Informatics', 'Mobile apps and hackathons.', 47.4789, 19.0663, [7, 4, 15], [[DB, 'PEER'], [ALGO, 'NEEDS_HELP']], true],
  ['Péter Mészáros', 'Faculty of Informatics', 'Theory nerd, happy to do proofs together.', 47.4876, 19.0491, [13, 12], [[ALGO, 'PEER'], [ANA, 'CAN_EXPLAIN']]],
];

export const people: MockPerson[] = rows.map(([displayName, faculty, bio, lat, lng, interestIdx, subjectRoles, likesYou = false], i) => ({
  user: { id: `00000000-0000-4000-8004-${String(i + 1).padStart(12, '0')}`, displayName, avatarUrl: null, faculty, bio },
  location: { lat, lng },
  interestIds: interestIdx.map((n) => interests[n].id),
  subjects: subjectRoles.map(([subjectId, role]) => ({ subjectId, role })),
  likesYou,
}));

export const personById = (id: string) => people.find((p) => p.user.id === id);
