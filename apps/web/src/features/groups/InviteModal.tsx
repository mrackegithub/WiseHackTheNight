import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import { Button } from '../../components/form/Button';
import { FormError } from '../../components/form/FormError';
import { Modal } from '../../components/Modal';
import { messageForError } from '../../lib/error-messages';
import { inZone } from '../../lib/time';

/** Makes an invite link (POST /groups/{id}/invites) for the member to send to whoever they choose. */
export function InviteModal({ group, onClose }: { group: Schemas['Group']; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const create = useMutation({
    mutationFn: () => unwrap(api.POST('/groups/{groupId}/invites', { params: { path: { groupId: group.id } } })),
    meta: { silent: true },
  });
  const link = create.data ? `${window.location.origin}/invite/${create.data.token}` : null;
  const spotsLeft = group.maxSize - group.memberCount;
  const canShare = typeof navigator.share === 'function';

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      (document.getElementById('invite-link') as HTMLInputElement | null)?.select(); // let them copy it by hand
    }
  }

  return (
    <Modal title="Invite people" onClose={onClose} size="md" description={`Send a link to the classmates you want in ${group.name}.`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          {spotsLeft > 0 ? `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left (${group.memberCount}/${group.maxSize}).` : `The group is full (${group.memberCount}/${group.maxSize}), so nobody can join until someone leaves.`}{' '}
          {group.isOpen ? 'Anyone with the link can join right away.' : 'Your group is invite-only, so this link is the way in.'}
        </p>
        <FormError message={create.error ? messageForError(create.error) : null} />

        {link ? (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="invite-link" className="text-sm font-medium text-slate-700">
                Invite link
              </label>
              <div className="flex gap-2">
                <input id="invite-link" readOnly value={link} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
                <Button onClick={() => void copy()}>{copied ? 'Copied!' : 'Copy'}</Button>
              </div>
              <p className="text-xs text-slate-500" aria-live="polite">
                Works until {inZone(create.data!.expiresAt).toFormat('ccc d LLL, HH:mm')} for everyone you send it to.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              {canShare && (
                <Button variant="secondary" onClick={() => void navigator.share({ title: `Join ${group.name}`, text: `Study ${group.subject.name} with us in ${group.name}:`, url: link }).catch(() => {})}>
                  Share…
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Not now
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} data-autofocus>
              Create invite link
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
