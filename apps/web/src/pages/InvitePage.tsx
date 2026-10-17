import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api/client';
import { ApiError, unwrap } from '../api/errors';
import { Button } from '../components/form/Button';
import { FormError } from '../components/form/FormError';
import { Spinner } from '../components/Spinner';
import { groupKeys } from '../features/groups/queries';
import { initials } from '../features/matching/card-helpers';
import { usePageTitle } from '../hooks/usePageTitle';
import { messageForError } from '../lib/error-messages';
import { toast } from '../lib/toast';

/** Where an invite link lands (/invite/:token): who invited you to which group, and a Join button. */
export function InvitePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => unwrap(api.GET('/invites/{token}', { params: { path: { token } } })),
    retry: false,
    meta: { silent: true },
  });
  const accept = useMutation({
    mutationFn: () => unwrap(api.POST('/invites/{token}/accept', { params: { path: { token } } })),
    meta: { silent: true },
    onSuccess: (group) => {
      queryClient.setQueryData(groupKeys.detail(group.id), group);
      void queryClient.invalidateQueries({ queryKey: groupKeys.list });
      toast.success(`You joined ${group.name}!`);
      navigate(`/groups/${group.id}`, { replace: true });
    },
  });
  usePageTitle(invite.data ? `Join ${invite.data.group.name}` : 'Group invite');

  if (invite.isPending) return <Spinner label="Opening invite" />;
  if (invite.isError) {
    const status = invite.error instanceof ApiError ? invite.error.status : 0;
    return (
      <section className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">{status === 410 ? 'This invite has expired' : status === 404 || status === 422 ? "This invite link doesn't work" : "Couldn't open the invite"}</h1>
        <p className="mt-2 text-slate-600">
          {status === 410 || status === 404 || status === 422 ? 'Ask whoever sent it for a new link.' : messageForError(invite.error)}
        </p>
        <Link to="/groups" className="mt-4 inline-block text-indigo-700 hover:underline">
          Go to my groups
        </Link>
      </section>
    );
  }

  const { group, invitedBy, alreadyMember } = invite.data;
  const full = group.memberCount >= group.maxSize;

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 py-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">{invitedBy.displayName}</span> invited you to join
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{group.name}</h1>
        <p className="text-sm text-slate-500">
          {group.subject.name} · {group.memberCount}/{group.maxSize} members
        </p>
        {group.description && <p className="mt-3 text-slate-700">{group.description}</p>}

        <ul className="mt-4 flex flex-wrap justify-center gap-3" aria-label="Members">
          {group.members.map((m) => (
            <li key={m.user.id} className="flex flex-col items-center gap-1 text-xs text-slate-600">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700" aria-hidden>
                {initials(m.user.displayName)}
              </span>
              {m.user.displayName.split(' ')[0]}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2">
          <FormError message={accept.error ? messageForError(accept.error) : null} />
          {alreadyMember ? (
            <Link to={`/groups/${group.id}`} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              You're already in this group. Open it
            </Link>
          ) : full ? (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">This group is full right now. Ask {invitedBy.displayName.split(' ')[0]} to make room.</p>
          ) : (
            <Button onClick={() => accept.mutate()} loading={accept.isPending}>
              Join group
            </Button>
          )}
          <Link to="/" className="text-sm text-slate-600 hover:underline">
            Not now
          </Link>
        </div>
      </div>
    </section>
  );
}
