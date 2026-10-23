import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import { createQueryClient } from '../../lib/query-client';
import { ZONE } from '../../lib/time';
import { loginAsDemo } from '../../test/render';
import { BusyTimeModal } from './BusyTimeModal';

function renderModal(props?: { defaultDate?: DateTime; onClose?: () => void }) {
  const queryClient = createQueryClient();
  const defaultDate = props?.defaultDate ?? DateTime.fromISO('2026-10-14', { zone: ZONE });
  const onClose = props?.onClose ?? vi.fn();

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <BusyTimeModal defaultDate={defaultDate} onClose={onClose} />
    </QueryClientProvider>,
  );

  return { ...utils, onClose, queryClient };
}

describe('BusyTimeModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
    loginAsDemo();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows "Ends next day" hint when endTime < startTime', async () => {
    const user = userEvent.setup();
    renderModal();

    const fromInput = screen.getByLabelText('From');
    const toInput = screen.getByLabelText('To');

    // Default is 18:00 to 19:30, so no overnight hint
    expect(screen.queryByText('Ends next day')).not.toBeInTheDocument();

    // Change times to 22:00 -> 02:00
    await user.clear(fromInput);
    await user.type(fromInput, '22:00');
    await user.clear(toInput);
    await user.type(toInput, '02:00');

    expect(screen.getByText('Ends next day')).toBeInTheDocument();

    // Change back to same-day
    await user.clear(toInput);
    await user.type(toInput, '23:30');
    expect(screen.queryByText('Ends next day')).not.toBeInTheDocument();
  });

  it('rejects endTime === startTime with validation error', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(api, 'POST');
    renderModal();

    const titleInput = screen.getByLabelText('What is it?');
    await user.type(titleInput, 'Evening shift');

    const fromInput = screen.getByLabelText('From');
    const toInput = screen.getByLabelText('To');
    await user.clear(fromInput);
    await user.type(fromInput, '18:00');
    await user.clear(toInput);
    await user.type(toInput, '18:00');

    await user.click(screen.getByRole('button', { name: 'Add busy time' }));

    expect(await screen.findByText('End must be after start.')).toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('submits overnight times with end date as the next day', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(api, 'POST');
    const { onClose } = renderModal();

    const titleInput = screen.getByLabelText('What is it?');
    await user.type(titleInput, 'Night shift');

    const fromInput = screen.getByLabelText('From');
    const toInput = screen.getByLabelText('To');
    await user.clear(fromInput);
    await user.type(fromInput, '22:00');
    await user.clear(toInput);
    await user.type(toInput, '02:00');

    expect(screen.getByText('Ends next day')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add busy time' }));

    expect(postSpy).toHaveBeenCalledWith('/me/schedule', {
      body: expect.objectContaining({
        title: 'Night shift',
        start: '2026-10-14T20:00:00Z', // 22:00 Budapest = 20:00 UTC
        end: '2026-10-15T00:00:00Z',   // 02:00 next day Budapest = 00:00 UTC
        category: 'OTHER',
        repeatWeeks: 0,
      }),
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('submits same-day times with start and end on the same date', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(api, 'POST');
    const { onClose } = renderModal();

    const titleInput = screen.getByLabelText('What is it?');
    await user.type(titleInput, 'Gym training');

    await user.click(screen.getByRole('button', { name: 'Add busy time' }));

    expect(postSpy).toHaveBeenCalledWith('/me/schedule', {
      body: expect.objectContaining({
        title: 'Gym training',
        start: '2026-10-14T16:00:00Z', // 18:00 Budapest = 16:00 UTC
        end: '2026-10-14T17:30:00Z',   // 19:30 Budapest = 17:30 UTC
        category: 'OTHER',
        repeatWeeks: 0,
      }),
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('requires a title', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(api, 'POST');
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Add busy time' }));

    expect(await screen.findByText('Give it a short name, e.g. "Part-time job".')).toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('displays conflict error message and keeps modal open when overlapping event exists', async () => {
    const user = userEvent.setup();
    const conflictMessage = 'You already have a class or busy block scheduled during this time: Algorithms Lecture';
    vi.spyOn(api, 'POST').mockResolvedValueOnce({
      response: new Response(null, { status: 409 }),
      error: { code: 'EVENT_CONFLICT', message: conflictMessage },
    } as any);

    const { onClose } = renderModal();

    const titleInput = screen.getByLabelText('What is it?');
    await user.type(titleInput, 'Gym');

    await user.click(screen.getByRole('button', { name: 'Add busy time' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(conflictMessage);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('displays fallback error message on 409 conflict when message is omitted', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'POST').mockResolvedValueOnce({
      response: new Response(null, { status: 409 }),
      error: { code: 'EVENT_CONFLICT', message: '' },
    } as any);

    const { onClose } = renderModal();

    const titleInput = screen.getByLabelText('What is it?');
    await user.type(titleInput, 'Study');

    await user.click(screen.getByRole('button', { name: 'Add busy time' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You already have an event scheduled during this time.',
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
