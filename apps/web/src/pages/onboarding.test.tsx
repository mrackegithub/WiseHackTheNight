import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { db, DEMO_USER_ID } from '../mocks/db';
import { loginAsDemo, renderApp } from '../test/render';

const demo = () => db.users.get(DEMO_USER_ID)!;

describe('Onboarding: profile step', () => {
  it('prefills the profile and saves it with PATCH /me', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    const { router } = renderApp('/onboarding');

    const name = await screen.findByLabelText('Name');
    expect(name).toHaveValue('Demo Student');
    await user.clear(name);
    await user.type(name, 'Demo Renamed');
    await user.clear(screen.getByLabelText('Faculty'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Your subjects' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?step=subjects');
    expect(demo().me.displayName).toBe('Demo Renamed');
    expect(demo().me.faculty).toBeNull(); // cleared field is sent as null
  });

  it('validates the name and bio length', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    renderApp('/onboarding');

    await user.clear(await screen.findByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Name must be 2–50 characters.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About you' })).toBeInTheDocument();
  });
});

describe('Onboarding: subjects step', () => {
  it('loads saved subjects, adds one from search with a role, and saves', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    renderApp('/onboarding?step=subjects');

    // the demo user starts with 3 subjects
    expect(await screen.findByText('Selected (3)')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search by name or Neptun code'), 'IP-18KRIP');
    const results = screen.getByRole('list', { name: 'Search results' });
    await user.click(await within(results).findByRole('button', { name: 'Add Cryptography' }));
    expect(screen.getByText('Selected (4)')).toBeInTheDocument();

    await user.click(screen.getAllByRole('radio', { name: 'I need help' }).at(-1)!);
    await user.selectOptions(screen.getByLabelText('Confidence in Cryptography'), '2');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Your interests' })).toBeInTheDocument();
    const saved = demo().subjects.find((s) => s.subject.code === 'IP-18KRIPEG');
    expect(saved).toMatchObject({ role: 'NEEDS_HELP', confidence: 2 });
    expect(demo().subjects).toHaveLength(4);
  });

  it('requires at least one subject', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    demo().subjects = [];
    renderApp('/onboarding?step=subjects');

    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one subject');
  });

  it('can remove a subject and go back to the profile step', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    renderApp('/onboarding?step=subjects');

    await user.click(await screen.findByRole('button', { name: 'Remove Analysis I' }));
    expect(screen.getByText('Selected (2)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'About you' })).toBeInTheDocument();
  });
});

describe('Onboarding: interests step', () => {
  it('toggles interest chips and saves them as interestIds', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    renderApp('/onboarding?step=interests');

    // demo starts with Exam prep, Competitive programming, Whiteboard explaining
    const examPrep = await screen.findByRole('button', { name: 'Exam prep' });
    expect(examPrep).toHaveAttribute('aria-pressed', 'true');
    await user.click(examPrep);
    await user.click(screen.getByRole('button', { name: 'Hackathons' }));
    expect(screen.getByText('3/15 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'How you like to study' })).toBeInTheDocument();
    expect((demo().me.interests ?? []).map((i) => i.label).sort()).toEqual(['Competitive programming', 'Hackathons', 'Whiteboard explaining']);
  });

  it('limits the selection to 15', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    demo().me.interests = [];
    renderApp('/onboarding?step=interests');

    const chips = within(await screen.findByRole('group', { name: 'Interests' })).getAllByRole('button');
    for (const chip of chips.slice(0, 16)) await user.click(chip);
    expect(screen.getByText('15/15 selected')).toBeInTheDocument();
    expect(chips[15]).toBeDisabled();
  });
});

describe('Onboarding: preferences step', () => {
  it('loads saved preferences, keeps min ≤ max, and saves with PUT /me/preferences', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    const { router } = renderApp('/onboarding?step=preferences');

    const min = await screen.findByLabelText('Smallest group');
    expect(screen.getByLabelText('Largest group')).toHaveValue('3');
    // moving "smallest" above "largest" pushes largest up too (jsdom has no slider keyboard support)
    fireEvent.change(min, { target: { value: '4' } });
    expect(screen.getByLabelText('Largest group')).toHaveValue('4');
    expect(screen.getAllByText('4 people')).toHaveLength(2); // both sliders show 4

    await user.click(screen.getByLabelText('Coworking space'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByText("You're all set! Start finding study partners.");
    expect(router.state.location.pathname).toBe('/');
    expect(demo().preferences).toMatchObject({ groupSizeMin: 4, groupSizeMax: 4, locationTypes: ['LIBRARY', 'CAFE', 'COWORKING'], mode: 'IN_PERSON' });
  });

  it('hides distance and places when studying online only', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    renderApp('/onboarding?step=preferences');

    expect(await screen.findByLabelText('Max distance from home')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Online' }));
    expect(screen.queryByLabelText('Max distance from home')).not.toBeInTheDocument();
    expect(screen.queryByText('Places you like')).not.toBeInTheDocument();
  });

  it('shows the defaults for a user who never saved preferences', async () => {
    loginAsDemo();
    demo().preferences = null;
    renderApp('/onboarding?step=preferences');
    expect(await screen.findByLabelText('Session length')).toHaveValue('90');
    expect(screen.getByRole('radio', { name: 'Either' })).toBeChecked();
  });
});
