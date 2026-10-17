import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/form/Button';

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/** The token in a pasted invite: the whole link (".../invite/<token>", any host) or just the token. */
function inviteTokenFrom(text: string): string | null {
  const s = text.trim();
  const fromLink = /\/invite\/([A-Za-z0-9_-]+)/.exec(s)?.[1];
  const token = fromLink ?? s;
  return TOKEN.test(token) ? token : null;
}

/** "Got an invite link?" box: paste it here instead of opening it in the browser. */
export function JoinWithLink() {
  const id = useId();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const token = inviteTokenFrom(value);
    if (!token) return setError('That doesn’t look like an invite link. It looks like …/invite/ followed by a code.');
    setError(null);
    navigate(`/invite/${token}`);
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-xl border border-slate-200 bg-white p-4">
      <label htmlFor={id} className="font-semibold">
        Got an invite link?
      </label>
      <p className="text-sm text-slate-600">Paste it here to see the group and join.</p>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://…/invite/…"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <Button type="submit" variant="secondary" disabled={!value.trim()}>
          Open
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
