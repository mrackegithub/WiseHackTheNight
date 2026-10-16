import { screen, within } from '@testing-library/react';
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

    expect(await screen.findByText("You're all set! Start finding study partners.")).toBeInTheDocument();
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
