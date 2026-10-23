import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import type { Schemas } from '@sgm/contracts';
import { ApiError } from '../api/errors';
import { Button } from '../components/form/Button';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../features/auth/auth-context';
import { usePageTitle } from '../hooks/usePageTitle';
import { InviteModal } from '../features/groups/InviteModal';
import { useGroup, useJoinGroup, useLeaveGroup } from '../features/groups/queries';
import { SessionsList } from '../features/groups/SessionsList';
import { SuggestedLocations } from '../features/groups/SuggestedLocations';
import { SuggestedSlots } from '../features/groups/SuggestedSlots';
import { initials, theirRole } from '../features/matching/card-helpers';
import { ScheduleSessionModal } from '../features/sessions/ScheduleSessionModal';
import { messageForError } from '../lib/error-messages';
import { formatSlot } from '../lib/time';
import { toast } from '../lib/toast';

export function GroupPage() {
  const { groupId = '' } = useParams();
  const { me } = useAuth();
  const navigate = useNavigate();
  const group = useGroup(groupId);
  const leave = useLeaveGroup(groupId);
  const join = useJoinGroup(groupId);
  const location = useLocation();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [scheduling, setScheduling] = useState<Schemas['SuggestedSlot'] | null>(null);
  // a group just created opens with its invite dialog
  const [inviting, setInviting] = useState(() => Boolean((location.state as { invite?: boolean } | null)?.invite));
  usePageTitle(group.data?.name ?? 'Group');

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true }); // so a reload doesn't reopen the dialog
  }, [location.state, location.pathname, navigate]);

  if (group.isPending) return <Spinner label="Loading group" />;
  if (group.isError) {
    return (
      <section className="py-16 text-center">
        <h1 className="text-2xl font-bold">{group.error instanceof ApiError && group.error.status === 404 ? 'Group not found' : "Couldn't load the group"}</h1>
        {!(group.error instanceof ApiError && group.error.status === 404) && <p className="mt-2 text-slate-600">{messageForError(group.error)}</p>}
        <Link to="/groups" className="mt-4 inline-block text-indigo-700 hover:underline">
          Back to my groups
        </Link>
      </section>
    );
  }

  const g = group.data;
  const isMember = g.members.some((m) => m.user.id === me?.id);

  function onLeave() {
    leave.mutate(undefined, {
      onSuccess: () => {
        toast.info(`You left ${g.name}.`);
        navigate('/groups', { replace: true });
      },
    });
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link to="/groups" className="text-sm text-indigo-700 hover:underline">
        ← My groups
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">
            {g.subject.name} · {g.subject.code}
            {!g.isOpen && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">Invite only</span>}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{g.name}</h1>
          {g.description && <p className="mt-1 text-slate-600">{g.description}</p>}
        </div>
        {isMember ? (
          <Button onClick={() => setInviting(true)}>Invite people</Button>
        ) : (
          <Button
            onClick={() =>
              join.mutate(undefined, {
                onSuccess: () => toast.success(`You joined ${g.name}!`),
                onError: (err) => toast.error(messageForError(err)),
              })
            }
            loading={join.isPending}
          >
            Join group
          </Button>
        )}
      </header>
      {inviting && isMember && <InviteModal group={g} onClose={() => setInviting(false)} />}

      <section aria-labelledby="members-heading" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="members-heading" className="font-semibold">
          Members ({g.memberCount}/{g.maxSize})
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {g.members.map((m) => (
            <li key={m.user.id} className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700" aria-hidden>
                {initials(m.user.displayName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {m.user.displayName}
                  {m.isOwner && <span className="ml-2 text-xs font-normal text-slate-500">organiser</span>}
                </p>
                {m.user.faculty && <p className="text-xs text-slate-500">{m.user.faculty}</p>}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${theirRole[m.role].className}`}>{theirRole[m.role].label}</span>
            </li>
          ))}
        </ul>
      </section>

      <SuggestedSlots
        group={g}
        action={
          isMember
            ? (slot) => (
                <Button variant="secondary" className="px-3 py-1" onClick={() => setScheduling(slot)} aria-label={`Schedule ${formatSlot(slot.start, slot.end)}`}>
                  Schedule
                </Button>
              )
            : undefined
        }
      />
      {scheduling && <ScheduleSessionModal group={g} slot={scheduling} onClose={() => setScheduling(null)} />}
      <SuggestedLocations groupId={g.id} />
      <SessionsList groupId={g.id} />

      {isMember && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {confirmLeave ? (
            <>
              <span className="text-sm text-slate-600">Leave {g.name}?</span>
              <Button variant="danger" onClick={onLeave} loading={leave.isPending}>
                Yes, leave
              </Button>
              <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmLeave(true)}>
              Leave group
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
