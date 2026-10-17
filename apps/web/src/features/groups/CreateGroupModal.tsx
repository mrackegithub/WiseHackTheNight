import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../api/client';
import { ApiError, unwrap } from '../../api/errors';
import { Button } from '../../components/form/Button';
import { FormError } from '../../components/form/FormError';
import { TextField } from '../../components/form/TextField';
import { Modal } from '../../components/Modal';
import { messageForError } from '../../lib/error-messages';
import { fieldErrors } from '../../lib/field-errors';
import { toast } from '../../lib/toast';
import { useMySubjects, useSubjectSearch } from '../profile/queries';
import { groupKeys } from './queries';

const selectClass = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal';

/** "New study group" (POST /groups). Opens the new group with its invite dialog, so people can be added right away. */
export function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const id = useId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mySubjects = useMySubjects();
  const allSubjects = useSubjectSearch('', 50);
  // your own subjects first; the whole catalogue if you haven't picked any yet
  const subjects = mySubjects.data?.length ? mySubjects.data.map((s) => s.subject) : (allSubjects.data?.items ?? []);

  const [values, setValues] = useState({ name: '', subjectId: '', maxSize: 4, description: '', inviteOnly: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const subjectId = values.subjectId || subjects[0]?.id || '';

  const create = useMutation({
    mutationFn: (body: Schemas['CreateGroupRequest']) => unwrap(api.POST('/groups', { body })),
    meta: { silent: true },
    onSuccess: (group) => {
      queryClient.setQueryData(groupKeys.detail(group.id), group);
      void queryClient.invalidateQueries({ queryKey: groupKeys.list });
      toast.success(`Created ${group.name}.`);
      navigate(`/groups/${group.id}`, { state: { invite: true } });
    },
    onError: (err) => setErrors(fieldErrors(err)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const name = values.name.trim();
    const next: Record<string, string> = {};
    if (name.length < 3) next.name = 'Give it a name of at least 3 characters.';
    if (!subjectId) next.subjectId = 'Pick a subject.';
    setErrors(next);
    if (Object.keys(next).length) return;
    create.mutate({
      name,
      subjectId,
      maxSize: values.maxSize,
      isOpen: !values.inviteOnly,
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
    });
  }

  const serverError = create.error && !(create.error instanceof ApiError && create.error.code === 'VALIDATION_FAILED') ? messageForError(create.error) : null;

  return (
    <Modal title="New study group" onClose={onClose} size="md" description="Start a group for one of your subjects, then invite people.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={serverError} />
        <TextField
          label="Group name"
          placeholder="e.g. Calculus Thursday crew"
          maxLength={60}
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          error={errors.name}
          data-autofocus
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-subject`} className="text-sm font-medium text-slate-700">
              Subject
            </label>
            <select
              id={`${id}-subject`}
              value={subjectId}
              onChange={(e) => setValues({ ...values, subjectId: e.target.value })}
              className={selectClass}
              aria-invalid={Boolean(errors.subjectId)}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.subjectId && <span className="text-xs text-red-700">{errors.subjectId}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-size`} className="text-sm font-medium text-slate-700">
              Max size
            </label>
            <select id={`${id}-size`} value={values.maxSize} onChange={(e) => setValues({ ...values, maxSize: Number(e.target.value) })} className={selectClass}>
              {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n} people
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-description`} className="text-sm font-medium text-slate-700">
            Description <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id={`${id}-description`}
            rows={2}
            maxLength={300}
            placeholder="When and how you like to study, e.g. weekly practice sheets after the Thursday lecture."
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-slate-700">Who can join</legend>
          {[
            { inviteOnly: false, label: 'Anyone', hint: 'Listed in Discover for classmates in this subject.' },
            { inviteOnly: true, label: 'Only people I invite', hint: 'Hidden from Discover; people join with your invite link.' },
          ].map((o) => (
            <label
              key={o.label}
              className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo-600 ${
                values.inviteOnly === o.inviteOnly ? 'border-slate-900 bg-slate-50' : 'border-slate-300'
              }`}
            >
              <input type="radio" name="who-can-join" checked={values.inviteOnly === o.inviteOnly} onChange={() => setValues({ ...values, inviteOnly: o.inviteOnly })} className="mt-0.5" />
              <span>
                <span className="block font-medium">{o.label}</span>
                <span className="block text-slate-600">{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create group
          </Button>
        </div>
      </form>
    </Modal>
  );
}
