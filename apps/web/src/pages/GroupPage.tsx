import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/errors';
import { Button } from '../components/form/Button';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../features/auth/auth-context';
import { useGroup, useLeaveGroup } from '../features/groups/queries';
import { SessionsList } from '../features/groups/SessionsList';
import { SuggestedSlots } from '../features/groups/SuggestedSlots';
import { initials, theirRole } from '../features/matching/card-helpers';
import { messageForError } from '../lib/error-messages';
import { toast } from '../lib/toast';

export function GroupPage() {
  const { groupId = '' } = useParams();
  const { me } = useAuth();
  const navigate = useNavigate();
  const group = useGroup(groupId);
  const leave = useLeaveGroup(groupId);
  const [confirmLeave, setConfirmLeave] = useState(false);

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
      <header>
        <p className="text-sm text-slate-500">
          {g.subject.name} · {g.subject.code}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{g.name}</h1>
        {g.description && <p className="mt-1 text-slate-600">{g.description}</p>}
      </header>

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

      <SuggestedSlots group={g} />
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
