import { Link } from 'react-router';
import type { Schemas } from '@sgm/contracts';
import { Modal } from '../../components/Modal';
import { formatSlot } from '../../lib/time';
import { useAuth } from '../auth/auth-context';
import { initials } from './card-helpers';

interface MatchModalProps {
  match: Schemas['Match'];
  candidate: Schemas['Candidate'];
  onClose: () => void;
}

function Avatar({ label, children }: { label: string; children: string }) {
  return (
    <span
      aria-label={label}
      role="img"
      className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-indigo-100 text-xl font-semibold text-indigo-700 shadow"
    >
      {children}
    </span>
  );
}

/** "It's a match!": shown after a mutual like (new group) or after joining an open group. */
export function MatchModal({ match, candidate, onClose }: MatchModalProps) {
  const { me } = useAuth();
  const other = match.otherUser;
  const groupName = candidate.kind === 'group' ? candidate.group?.name : null;
  const firstSlot = candidate.sharedSlots[0];

  return (
    <Modal
      title={other ? "It's a match!" : "You're in!"}
      onClose={onClose}
      description={
        other ? (
          <>
            You and <strong>{other.displayName}</strong> both want to study <strong>{match.subject.name}</strong>. We started a study group for
            you.
          </>
        ) : (
          <>
            You joined <strong>{groupName ?? 'the group'}</strong> for <strong>{match.subject.name}</strong>.
          </>
        )
      }
    >
      <div className="flex justify-center -space-x-3" aria-hidden={false}>
        <Avatar label={me?.displayName ?? 'You'}>{initials(me?.displayName ?? 'You')}</Avatar>
        {other ? <Avatar label={other.displayName}>{initials(other.displayName)}</Avatar> : <Avatar label={groupName ?? 'Group'}>👥</Avatar>}
      </div>

      {firstSlot && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-900">
          You're both free <strong>{formatSlot(firstSlot.start, firstSlot.end)}</strong>
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <Link
          to={`/groups/${match.groupId}`}
          data-autofocus
          className="rounded-md bg-indigo-600 px-4 py-2.5 text-center font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Go to group
        </Link>
        <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Keep swiping
        </button>
      </div>
    </Modal>
  );
}
