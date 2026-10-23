import { useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../api/client';
import { ApiError, unwrap } from '../../api/errors';
import { Button } from '../../components/form/Button';
import { FormError } from '../../components/form/FormError';
import { QueryError } from '../../components/QueryError';
import { TextField } from '../../components/form/TextField';
import { messageForError } from '../../lib/error-messages';
import { fieldErrors } from '../../lib/field-errors';
import { ZONE } from '../../lib/time';
import { toast } from '../../lib/toast';
import { profileKeys } from '../profile/queries';
import { calendarKeys } from './queries';
import { icsUploadForm } from './upload';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const FEED_URL = /^(https?|webcals?):\/\/\S+$/i;
const neptunKey = ['me', 'neptun'] as const;

const statusBadge: Record<Schemas['NeptunConnection']['status'], { label: string; className: string }> = {
  NOT_CONNECTED: { label: 'Not connected', className: 'bg-slate-100 text-slate-700' },
  OK: { label: 'Synced', className: 'bg-emerald-100 text-emerald-800' },
  SYNCING: { label: 'Syncing…', className: 'bg-amber-100 text-amber-800' },
  ERROR: { label: 'Sync failed', className: 'bg-red-100 text-red-800' },
};

function describeSync(r: Schemas['SyncResult']) {
  const parts = [`${r.imported} new`, `${r.removed} removed`];
  if (r.subjectsLinked) parts.push(`${r.subjectsLinked} subject${r.subjectsLinked === 1 ? '' : 's'} added to your profile`);
  return `Calendar synced: ${parts.join(', ')}.`;
}

export function NeptunPanel() {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [icsUrl, setIcsUrl] = useState('');
  const [urlError, setUrlError] = useState<string>();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const status = useQuery({ queryKey: neptunKey, queryFn: () => unwrap(api.GET('/integrations/neptun')), meta: { silent: true } });

  const refreshAll = (next?: Schemas['NeptunConnection']) => {
    if (next) queryClient.setQueryData(neptunKey, next);
    else void queryClient.invalidateQueries({ queryKey: neptunKey });
    void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    void queryClient.invalidateQueries({ queryKey: profileKeys.subjects });
  };

  const connect = useMutation({
    mutationFn: (url: string) => unwrap(api.PUT('/integrations/neptun', { body: { icsUrl: url } })),
    meta: { silent: true },
    onSuccess: (conn) => {
      refreshAll(conn);
      if (conn.status === 'OK') {
        setIcsUrl('');
        toast.success('Neptun connected. Your classes are in the calendar.');
      }
    },
    onError: (err) => {
      const field = fieldErrors(err).icsUrl;
      setUrlError(field ?? messageForError(err));
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      unwrap(
        // reason: the generated type says `string` for `format: binary`; the real payload is the File.
        api.POST('/integrations/neptun/upload', { body: { file: file as unknown as string }, bodySerializer: icsUploadForm }),
      ),
    onSuccess: (result) => {
      refreshAll();
      toast.success(describeSync(result));
    },
  });

  const sync = useMutation({
    mutationFn: () => unwrap(api.POST('/integrations/neptun/sync')),
    meta: { silent: true },
    onSuccess: (result) => {
      refreshAll();
      toast.success(describeSync(result));
    },
    onError: (err) => {
      refreshAll();
      toast.error(err instanceof ApiError && err.status === 409 ? 'Connect your Neptun calendar first.' : messageForError(err));
    },
  });

  const disconnect = useMutation({
    mutationFn: () => unwrap(api.DELETE('/integrations/neptun')),
    onSuccess: () => {
      setConfirmingDisconnect(false);
      refreshAll();
      toast.info('Neptun disconnected and imported classes removed.');
    },
  });

  function onConnect() {
    const url = icsUrl.trim();
    if (!FEED_URL.test(url)) return setUrlError('Paste a link that starts with webcal:// or https://');
    setUrlError(undefined);
    connect.mutate(url);
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return toast.error('That file is larger than 2 MB.');
    upload.mutate(file);
  }

  if (status.isError) return <QueryError compact what="your Neptun connection" error={status.error} onRetry={() => void status.refetch()} />;
  const conn = status.data;
  if (!conn) return null;
  const badge = statusBadge[conn.status];
  const syncedAt = conn.lastSyncedAt ? DateTime.fromISO(conn.lastSyncedAt).setZone(ZONE) : null;
  const lastSynced = syncedAt && (Math.abs(syncedAt.diffNow('minutes').minutes) < 1 ? 'just now' : syncedAt.toRelative());

  return (
    <section aria-labelledby="neptun-heading" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="neptun-heading" className="font-semibold">
          Neptun calendar
        </h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
        <p className="text-sm text-slate-600">
          {lastSynced && <>Last synced {lastSynced}</>}
          {conn.eventCount ? <> · {conn.eventCount} classes</> : null}
          {!conn.connected && conn.eventCount ? <> · imported from a file</> : null}
        </p>
        {conn.connected && (
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={() => sync.mutate()} loading={sync.isPending}>
              Sync now
            </Button>
            {confirmingDisconnect ? (
              <>
                <Button variant="danger" onClick={() => disconnect.mutate()} loading={disconnect.isPending}>
                  Yes, disconnect
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingDisconnect(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmingDisconnect(true)}>
                Disconnect
              </Button>
            )}
          </div>
        )}
      </div>

      {conn.status === 'ERROR' && <FormError message={conn.lastError ?? 'The last sync failed.'} />}

      {(!conn.connected || conn.status === 'ERROR') && (
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <TextField
            label="Calendar link from Neptun"
            hint="In Neptun, copy the calendar link offered for Google Calendar import (webcal:// or https://)."
            placeholder="webcal://…"
            value={icsUrl}
            onChange={(e) => setIcsUrl(e.target.value)}
            error={urlError}
          />
          <Button onClick={onConnect} loading={connect.isPending} className="md:mb-5">
            Connect
          </Button>
          <div className="text-sm text-slate-600 md:col-span-2">
            No link? Export your timetable as an <strong>.ics</strong> file and{' '}
            <button type="button" className="font-medium text-indigo-700 hover:underline" onClick={() => fileInput.current?.click()}>
              upload it
            </button>{' '}
            (max 2 MB).
            <input ref={fileInput} type="file" accept=".ics,text/calendar" className="sr-only" aria-label="Upload .ics file" onChange={onFile} />
            {upload.isPending && <span className="ml-2 text-slate-500">Uploading…</span>}
          </div>
        </div>
      )}
    </section>
  );
}
