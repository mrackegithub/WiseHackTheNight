import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defaultPreferences, db, DEMO_USER_ID, updateOnboarding } from '../mocks/db';
import { subjects } from '../mocks/data/subjects';
import { loginAsDemo, loginAsNewUser, renderApp } from '../test/render';

// Leaflet can't be clicked in jsdom; stand in a button that "clicks the map".
vi.mock('../components/map/MapPicker', () => ({
  default: ({ onChange }: { onChange: (p: { lat: number; lng: number }) => void }) => (
    <button type="button" onClick={() => onChange({ lat: 47.49876, lng: 19.04044 })}>
      Click map
    </button>
  ),
}));

/** A user who did every step but location (as if PUT /me/subjects and /me/preferences ran). */
const readyExceptLocation = (mode: 'IN_PERSON' | 'ONLINE' | 'EITHER' = 'EITHER') =>
  loginAsNewUser((u) => {
    u.subjects = [{ subject: subjects[0], role: 'PEER', confidence: 3 }];
    u.preferences = { ...defaultPreferences(), mode };
    updateOnboarding(u); // the server re-evaluates after those PUTs; ONLINE-only users are done here
  });

describe('Onboarding: location step', () => {
  it('finds an address, saves it rounded, and completes onboarding', async () => {
    const user = userEvent.setup();
    const me = readyExceptLocation();
    const { router } = renderApp('/onboarding?step=location');

    await user.type(await screen.findByLabelText('Address or landmark'), 'kalvin{Enter}');
    const results = await screen.findByRole('list', { name: 'Address results' });
    await user.click(within(results).getByRole('button', { name: /Kálvin tér/ }));
    expect(screen.getByText(/Selected:/)).toHaveTextContent('Kálvin tér, Budapest VIII. (47.490, 19.061)');

    await user.click(screen.getByRole('button', { name: 'Finish' }));

    expect(await screen.findByText("You're all set! Start finding study partners.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(db.users.get(me.me.id)!.me).toMatchObject({ onboardingComplete: true, location: { lat: 47.49, lng: 19.061 } });
  });

  it('accepts a pin dropped on the map', async () => {
    const user = userEvent.setup();
    const me = readyExceptLocation();
    renderApp('/onboarding?step=location');

    await user.click(await screen.findByRole('button', { name: 'Click map' }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    await screen.findByText("You're all set! Start finding study partners.");
    expect(db.users.get(me.me.id)!.me.location).toEqual({ lat: 47.499, lng: 19.04, label: 'Pinned on map' });
  });

  it('requires a location for in-person study, but lets online-only users skip', async () => {
    const user = userEvent.setup();
    readyExceptLocation('IN_PERSON');
    const first = renderApp('/onboarding?step=location');
    await user.click(await screen.findByRole('button', { name: 'Finish' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Search for an address or click the map');
    first.unmount();

    readyExceptLocation('ONLINE');
    const { router } = renderApp('/onboarding?step=location');
    await user.click(await screen.findByRole('button', { name: 'Skip and finish' }));
    await screen.findByText("You're all set! Start finding study partners.");
    expect(router.state.location.pathname).toBe('/');
  });

  it('says what is missing instead of finishing an incomplete profile', async () => {
    const user = userEvent.setup();
    loginAsNewUser(); // no subjects, no preferences
    const { router } = renderApp('/onboarding?step=location');

    await user.click(await screen.findByRole('button', { name: 'Click map' }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    expect(await screen.findByText(/Almost there/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboarding');
  });

  it('says when an address search finds nothing', async () => {
    const user = userEvent.setup();
    readyExceptLocation();
    renderApp('/onboarding?step=location');
    await user.type(await screen.findByLabelText('Address or landmark'), 'Atlantis');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/No places found/)).toBeInTheDocument();
  });
});

describe('RequireOnboarding guard', () => {
  it('sends users who have not finished onboarding to the wizard', async () => {
    loginAsNewUser();
    const { router } = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Set up your profile' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboarding');
  });

  it('lets onboarded users in', async () => {
    loginAsDemo(DEMO_USER_ID);
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Welcome, Demo Student!' })).toBeInTheDocument();
  });
});
