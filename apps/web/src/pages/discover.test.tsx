import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'framer-motion';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, DEMO_USER_ID } from '../mocks/db';
import { loginAsDemo, renderApp } from '../test/render';

const demo = () => db.users.get(DEMO_USER_ID)!;
const topCard = () => screen.findByRole('article');
const topName = async () => within(await topCard()).getByRole('heading', { level: 2 }).textContent;

/** Passes until `name` is on top (bounded), so tests don't depend on exact ranking. */
async function passUntil(user: ReturnType<typeof userEvent.setup>, name: string) {
  for (let i = 0; i < 15 && (await topName()) !== name; i++) await user.click(screen.getByRole('button', { name: 'Pass' }));
  expect(await topName()).toBe(name);
}

describe('DiscoverPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
    loginAsDemo();
  });
  afterEach(() => vi.useRealTimers());

  it('shows the best candidate with role, distance, shared slots and the score breakdown', async () => {
    renderApp('/discover');
    const card = await topCard();

    expect(screen.getByLabelText('Subject')).toHaveValue(demo().subjects[0].subject.id);
    expect(within(card).getByText(/Needs help|Can explain|Studies as a peer/)).toBeInTheDocument();
    expect(within(card).getByText(/km away/)).toBeInTheDocument();
    expect(within(card).getByText(/shared free time/)).toBeInTheDocument();
    const slots = within(within(card).getByRole('list', { name: 'Shared free slots' })).getAllByRole('listitem');
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.length).toBeLessThanOrEqual(3);
    expect(slots[0]).toHaveTextContent(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} · \d\d:\d\d–\d\d:\d\d$/);
    for (const label of ['Shared free time', 'Role fit', 'Shared interests', 'Distance', 'Group size fit']) {
      expect(within(card).getByText(label)).toBeInTheDocument();
    }
  });

  it('records a pass and shows the next person', async () => {
    const user = userEvent.setup();
    renderApp('/discover');
    const first = await topName();

    await user.click(screen.getByRole('button', { name: 'Pass' }));

    expect(await topName()).not.toBe(first);
    await vi.waitFor(() => expect(demo().swipes).toHaveLength(1));
    expect(demo().swipes[0]).toMatchObject({ targetKind: 'user', direction: 'PASS' });
  });

  it('hides the card that is flying out from assistive tech while the next one takes over', async () => {
    MotionGlobalConfig.skipAnimations = false;
    try {
      const user = userEvent.setup();
      renderApp('/discover');
      const first = await topName();

      await user.click(screen.getByRole('button', { name: 'Like' }));

      // during the exit animation both cards are in the DOM, but only the new one is exposed
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(await topName()).not.toBe(first);
      expect(screen.getByRole('article', { name: first!, hidden: true }).closest('[aria-hidden="true"]')).not.toBeNull();
    } finally {
      MotionGlobalConfig.skipAnimations = true;
    }
  });

  it('supports ← and → keys', async () => {
    const user = userEvent.setup();
    renderApp('/discover');
    await topCard();

    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{ArrowRight}');

    await vi.waitFor(() => expect(demo().swipes.map((s) => s.direction)).toEqual(['PASS', 'LIKE']));
  });

  it('turns a mutual like into a match and a new group', async () => {
    const user = userEvent.setup();
    renderApp('/discover');
    await passUntil(user, 'Anna Kovács'); // Anna already liked the demo user

    await user.click(screen.getByRole('button', { name: 'Like' }));

    const dialog = await screen.findByRole('dialog', { name: "It's a match!" });
    expect(dialog).toHaveAccessibleDescription(/You and Anna Kovács both want to study Algorithms and Data Structures I/);
    expect(demo().matches[0]).toMatchObject({ otherUser: { displayName: 'Anna Kovács' }, subject: { name: 'Algorithms and Data Structures I' } });
    expect(db.groups.get(demo().matches[0].groupId)!.members).toHaveLength(2);
  });

  it('lets you join an open group from the "Open groups" deck', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/discover');
    await topCard();

    await user.click(screen.getByRole('radio', { name: 'Open groups' }));
    expect(router.state.location.search).toContain('kind=group');
    const card = await screen.findByRole('article', { name: 'Algo Night Owls' });
    expect(within(card).getByText('2/4 members')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Like' }));
    expect(await screen.findByRole('dialog', { name: "You're in!" })).toHaveAccessibleDescription(
      'You joined Algo Night Owls for Algorithms and Data Structures I.',
    );
    await user.click(screen.getByRole('button', { name: 'Keep swiping' }));
    expect(await screen.findByText("You've seen everyone for now.")).toBeInTheDocument();
  });

  it('switches subject and resets the deck', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/discover');
    await topCard();

    await user.selectOptions(screen.getByLabelText('Subject'), demo().subjects[2].subject.id); // Databases I
    expect(router.state.location.search).toContain(`subject=${demo().subjects[2].subject.id}`);
    expect(await topCard()).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Open groups' }));
    expect(await screen.findByText("You've seen everyone for now.")).toBeInTheDocument(); // SQL Squad is full
  });

  it('asks users without subjects to add some', async () => {
    demo().subjects = [];
    renderApp('/discover');
    expect(await screen.findByRole('link', { name: 'Add subjects' })).toHaveAttribute('href', '/onboarding?step=subjects');
  });
});
