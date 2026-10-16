import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import { QueryError } from '../../components/QueryError';
import { Spinner } from '../../components/Spinner';

const roomsKey = (locationId: string, start: string, end: string, capacity: number) => ['rooms', locationId, start, end, capacity] as const;

interface RoomPickerProps {
  locationId: string;
  start: string;
  end: string;
  capacity: number;
  value: Schemas['Room'] | null;
  onChange: (room: Schemas['Room'] | null) => void;
}

/** Rooms at the location that are free for the whole session and fit the group. */
export function RoomPicker({ locationId, start, end, capacity, value, onChange }: RoomPickerProps) {
  const rooms = useQuery({
    queryKey: roomsKey(locationId, start, end, capacity),
    queryFn: () => unwrap(api.GET('/rooms', { params: { query: { locationId, start, end, capacity } } })),
    staleTime: 0,
    meta: { silent: true },
  });

  const option = 'flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 has-checked:border-indigo-500 has-checked:bg-indigo-50';

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-slate-700">Book a room? (for {capacity} people)</legend>
      {rooms.isPending && <Spinner label="Checking free rooms" />}
      {rooms.isError && <QueryError compact what="free rooms" error={rooms.error} onRetry={() => void rooms.refetch()} />}
      {rooms.data?.length === 0 && <p className="text-sm text-slate-500">No free room at that time. You can still meet there without booking.</p>}
      {rooms.data?.map((r) => (
        <label key={r.id} className={option}>
          <input type="radio" name="room" className="mt-1 accent-indigo-600" checked={value?.id === r.id} onChange={() => onChange(r)} />
          <span className="text-sm">
            <span className="font-medium">{r.name}</span>
            <span className="block text-xs text-slate-500">
              Up to {r.capacity} people{r.equipment?.length ? ` · ${r.equipment.join(', ')}` : ''}
            </span>
          </span>
        </label>
      ))}
      <label className={option}>
        <input type="radio" name="room" className="mt-1 accent-indigo-600" checked={value === null} onChange={() => onChange(null)} />
        <span className="text-sm font-medium">Don't book a room</span>
      </label>
    </fieldset>
  );
}
