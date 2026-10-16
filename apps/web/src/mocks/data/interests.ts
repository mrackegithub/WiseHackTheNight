import type { Schemas } from '@sgm/contracts';

const raw: [slug: string, label: string][] = [
  ['exam-prep', 'Exam prep'],
  ['homework', 'Homework'],
  ['projects', 'Group projects'],
  ['competitive-programming', 'Competitive programming'],
  ['hackathons', 'Hackathons'],
  ['open-source', 'Open source'],
  ['web-dev', 'Web development'],
  ['mobile-dev', 'Mobile apps'],
  ['game-dev', 'Game development'],
  ['machine-learning', 'Machine learning'],
  ['data-science', 'Data science'],
  ['security', 'Security / CTF'],
  ['math', 'Mathematics'],
  ['theory', 'Theoretical CS'],
  ['robotics', 'Robotics'],
  ['startups', 'Startups'],
  ['research', 'Research'],
  ['thesis', 'Thesis writing'],
  ['english', 'Studying in English'],
  ['hungarian', 'Studying in Hungarian'],
  ['pomodoro', 'Pomodoro sessions'],
  ['quiet-study', 'Quiet study'],
  ['whiteboard', 'Whiteboard explaining'],
  ['coffee', 'Coffee-fuelled'],
  ['night-owl', 'Night owl'],
];

export const interests: Schemas['Interest'][] = raw.map(([slug, label], i) => ({
  id: `00000000-0000-4000-8002-${String(i + 1).padStart(12, '0')}`,
  slug,
  label,
}));

export const interestById = (id: string) => interests.find((i) => i.id === id);
