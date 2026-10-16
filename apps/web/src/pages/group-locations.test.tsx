import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginAsDemo, renderApp } from '../test/render';

// Leaflet markers can't be clicked in jsdom; render them as buttons to test list ⇄ map syncing.
vi.mock('../components/map/LocationsMap', () => ({
  default: ({ places, selectedId, onSelect }: { places: { id: string; name: string }[]; selectedId: string | null; onSelect: (id: string) => void }) => (
    <div aria-label="Map">
      {places.map((p) => (
        <button key={p.id} type="button" aria-label={`Marker ${p.name}`} aria-current={p.id === selectedId || undefined} onClick={() => onSelect(p.id)} />
      ))}
    </div>
  ),
}));

const DB_CREW = '00000000-0000-4000-8005-000000000004';

describe('Suggested places', () => {
  beforeEach(() => loginAsDemo());

  it('lists nearby places ranked by the longest trip, with distances and bookable badges', async () => {
    renderApp(`/groups/${DB_CREW}`);
    const section = await screen.findByRole('region', { name: 'Suggested places' });
    const items = await within(section).findAllByRole('listitem');

    expect(items).toHaveLength(5);
    const maxes = items.map((li) => Number(/At most ([\d.]+) km/.exec(li.textContent ?? '')?.[1]));
    expect(maxes.every((m) => m <= 3.5)).toBe(true);
    expect(items[0]).toHaveTextContent(/^1\. /);
    expect(within(section).getAllByText('Bookable').length).toBeGreaterThan(0);
  });

  it('keeps the list and the map selection in sync', async () => {
    const user = userEvent.setup();
    renderApp(`/groups/${DB_CREW}`);
    const section = await screen.findByRole('region', { name: 'Suggested places' });
    const [first, second] = await within(section).findAllByRole('button', { pressed: false });

    // the first line of each list button is "N. Place name"
    const placeName = (button: HTMLElement) => button.querySelector('span > span')!.textContent!.replace(/^\d+\.\s*/, '');

    await user.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByLabelText('Map')).getByRole('button', { name: `Marker ${placeName(second)}` })).toHaveAttribute('aria-current', 'true');

    await user.click(within(screen.getByLabelText('Map')).getByRole('button', { name: `Marker ${placeName(first)}` }));
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'false');
  });

  it('filters by place type', async () => {
    const user = userEvent.setup();
    renderApp(`/groups/${DB_CREW}`);
    const section = await screen.findByRole('region', { name: 'Suggested places' });
    await within(section).findAllByRole('listitem');

    await user.selectOptions(within(section).getByLabelText('Type'), 'CAFE');
    await vi.waitFor(() => {
      const items = within(section).getAllByRole('listitem');
      expect(items.length).toBeGreaterThan(0);
      for (const li of items) expect(li).toHaveTextContent('Café ·');
    });

    await user.selectOptions(within(section).getByLabelText('Type'), 'OTHER');
    await user.selectOptions(within(section).getByLabelText('Type'), 'COWORKING');
    expect(await within(section).findAllByRole('listitem')).not.toHaveLength(0);
  });
});
