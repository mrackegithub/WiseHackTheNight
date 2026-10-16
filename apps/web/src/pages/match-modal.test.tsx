import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, DEMO_USER_ID } from '../mocks/db';
import { loginAsDemo, renderApp } from '../test/render';

const demo = () => db.users.get(DEMO_USER_ID)!;
const topName = async () => within(await screen.findByRole('article')).getByRole('heading', { level: 2 }).textContent;

async function matchWithAnna(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 15 && (await topName()) !== 'Anna Kovács'; i++) await user.click(screen.getByRole('button', { name: 'Pass' }));
  await user.click(screen.getByRole('button', { name: 'Like' }));
  return screen.findByRole('dialog', { name: "It's a match!" });
}

describe('Match modal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
    loginAsDemo();
  });
  afterEach(() => vi.useRealTimers());

  it('shows both people and the first shared slot, focused on "Go to group"', async () => {
    const user = userEvent.setup();
    renderApp('/discover');
    const dialog = await matchWithAnna(user);

    expect(within(dialog).getByRole('img', { name: 'Demo Student' })).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Anna Kovács' })).toBeInTheDocument();
    expect(within(dialog).getByText(/You're both free/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Go to group' })).toHaveFocus();
  });

  it('opens the new group with both members', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/discover');
    const dialog = await matchWithAnna(user);

    await user.click(within(dialog).getByRole('link', { name: 'Go to group' }));

    expect(router.state.location.pathname).toBe(`/groups/${demo().matches[0].groupId}`);
    expect(await screen.findByRole('heading', { name: 'Algorithms and Data Structures I study group' })).toBeInTheDocument();
    const members = within(screen.getByRole('region', { name: /Members \(2\// })).getAllByRole('listitem');
    // textContent = initials + name (+ "organiser") + faculty + role badge
    expect(members.map((m) => m.textContent)).toEqual([
      'AKAnna KovácsorganiserFaculty of InformaticsNeeds help',
      'DSDemo StudentFaculty of InformaticsCan explain',
    ]);
  });

  it('closes with Escape or "Keep swiping", and arrow keys do not swipe while it is open', async () => {
    const user = userEvent.setup();
    renderApp('/discover');
    await matchWithAnna(user);
    const swipes = demo().swipes.length;

    await user.keyboard('{ArrowRight}');
    expect(demo().swipes).toHaveLength(swipes);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    await vi.waitFor(() => expect(demo().swipes).toHaveLength(swipes + 1));
  });
});

describe('GroupPage', () => {
  beforeEach(() => loginAsDemo());

  it('shows a not-found state for unknown groups', async () => {
    renderApp('/groups/00000000-0000-4000-8005-999999999999');
    expect(await screen.findByRole('heading', { name: 'Group not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to my groups' })).toBeInTheDocument();
  });

  it("shows a seeded group the user belongs to", async () => {
    renderApp('/groups/00000000-0000-4000-8005-000000000004');
    expect(await screen.findByRole('heading', { name: 'DB Thursday crew' })).toBeInTheDocument();
    expect(screen.getByText('We meet after the Thursday lecture.')).toBeInTheDocument();
  });
});
