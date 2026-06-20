import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Loader2 } from 'lucide-react';
import {
  getGoogleStatus,
  getGoogleConnectUrl,
  listGoogleCalendars,
  saveGoogleCalendars,
  disconnectGoogle,
  type GoogleCalendarSource,
} from '../../api/google';

export function GoogleCalendarSection() {
  const qc = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['google-status'],
    queryFn: getGoogleStatus,
  });
  const connected = status?.connected ?? false;

  const { data: calendars } = useQuery({
    queryKey: ['google-calendars'],
    queryFn: listGoogleCalendars,
    enabled: connected,
  });

  const saveMutation = useMutation({
    mutationFn: saveGoogleCalendars,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['google-calendars'] });
      qc.invalidateQueries({ queryKey: ['google-events'] });
      qc.invalidateQueries({ queryKey: ['google-status'] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectGoogle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['google-status'] });
      qc.invalidateQueries({ queryKey: ['google-events'] });
    },
  });

  async function connect() {
    window.location.href = await getGoogleConnectUrl();
  }

  function updateCalendar(id: string, patch: Partial<GoogleCalendarSource>) {
    const next = (calendars ?? []).map((c) =>
      c.calendarId === id ? { ...c, ...patch } : c
    );
    saveMutation.mutate(next);
  }

  if (isLoading) {
    return (
      <div className="px-4 py-2 text-sm text-ink-muted flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="px-4 py-2 text-xs text-ink-muted">
        Google Calendar isn't configured on the server (missing
        <code className="mx-1">GOOGLE_CLIENT_ID</code> / secret).
      </div>
    );
  }

  return (
    <div className="px-4 py-2 space-y-3">
      {!connected ? (
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-ink-muted">
            Show your Google Calendar events (jobs, personal, family) in the
            calendar — read-only.
          </div>
          <button
            onClick={connect}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:opacity-90"
          >
            <CalendarDays className="w-4 h-4" /> Connect
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-ink">
              Connected — pick which calendars to show and their colours:
            </div>
            <button
              onClick={() => disconnectMutation.mutate()}
              className="shrink-0 text-xs text-ink-muted hover:text-red-500"
            >
              Disconnect
            </button>
          </div>

          <div className="space-y-1.5">
            {(calendars ?? []).map((c) => (
              <div key={c.calendarId} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) => updateCalendar(c.calendarId, { enabled: e.target.checked })}
                  className="accent-accent"
                />
                <input
                  type="color"
                  value={c.color}
                  onChange={(e) => updateCalendar(c.calendarId, { color: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border border-edge bg-transparent shrink-0"
                  title="Colour"
                />
                <span className="text-sm text-ink truncate flex-1">{c.name}</span>
              </div>
            ))}
            {calendars && calendars.length === 0 && (
              <div className="text-xs text-ink-muted">No calendars found on this account.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
