import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Loader2, CheckSquare } from 'lucide-react';
import {
  getGoogleStatus,
  getGoogleConnectUrl,
  listGoogleCalendars,
  saveGoogleCalendars,
  disconnectGoogle,
  getGoogleTaskLists,
  type GoogleCalendarSource,
} from '../../api/google';
import { getBoards, updateBoard } from '../../api/boards';

export function GoogleCalendarSection() {
  const qc = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['google-status'],
    queryFn: getGoogleStatus,
  });
  const connected = status?.connected ?? false;
  const tasksScope = status?.tasksScope ?? false;
  const [linkBoard, setLinkBoard] = useState('');
  const [linkList, setLinkList] = useState('');

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

  // Boards + Google Tasks lists, for linking a board to a list (two-way to-do sync).
  const { data: boards = [] } = useQuery({
    queryKey: ['boards'],
    queryFn: getBoards,
    enabled: connected && tasksScope,
  });
  const { data: taskLists = [] } = useQuery({
    queryKey: ['google-task-lists'],
    queryFn: getGoogleTaskLists,
    enabled: connected && tasksScope,
  });

  const linkMutation = useMutation({
    mutationFn: ({ boardId, listId }: { boardId: string; listId: string | null }) => {
      const board = boards.find((b) => b.id === boardId);
      return updateBoard(boardId, { settings: { ...(board?.settings ?? {}), googleTaskListId: listId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boards'] });
      setLinkBoard('');
      setLinkList('');
    },
  });

  const linkedBoards = boards.filter((b) => b.settings?.googleTaskListId);
  const listName = (id?: string | null) => taskLists.find((l) => l.id === id)?.title ?? '(list)';

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

          {/* Google Tasks — two-way to-do sync */}
          <div className="pt-3 border-t border-edge space-y-2">
            <div className="flex items-center gap-1.5 text-sm text-ink">
              <CheckSquare className="w-4 h-4 text-ink-faint" /> Google Tasks (to-do sync)
            </div>
            {!tasksScope ? (
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs text-ink-muted">
                  Reconnect Google to grant access to your Tasks, then link a board to a task list.
                </div>
                <button
                  onClick={connect}
                  className="shrink-0 px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:opacity-90"
                >
                  Reconnect
                </button>
              </div>
            ) : (
              <>
                {linkedBoards.length > 0 && (
                  <div className="space-y-1">
                    {linkedBoards.map((b) => (
                      <div key={b.id} className="flex items-center gap-2 text-sm">
                        <span className="text-ink truncate flex-1">
                          {b.name} <span className="text-ink-faint">↔ {listName(b.settings.googleTaskListId)}</span>
                        </span>
                        <button
                          onClick={() => linkMutation.mutate({ boardId: b.id, listId: null })}
                          className="text-xs text-ink-muted hover:text-red-500 shrink-0"
                        >
                          Unlink
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <select
                    value={linkBoard}
                    onChange={(e) => setLinkBoard(e.target.value)}
                    className="text-xs bg-input-bg border border-edge rounded px-1.5 py-1 text-ink flex-1 min-w-0"
                  >
                    <option value="">Board…</option>
                    {boards.filter((b) => !b.settings?.googleTaskListId).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <span className="text-ink-faint text-xs">↔</span>
                  <select
                    value={linkList}
                    onChange={(e) => setLinkList(e.target.value)}
                    className="text-xs bg-input-bg border border-edge rounded px-1.5 py-1 text-ink flex-1 min-w-0"
                  >
                    <option value="">Task list…</option>
                    {taskLists.map((l) => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                  <button
                    disabled={!linkBoard || !linkList || linkMutation.isPending}
                    onClick={() => linkMutation.mutate({ boardId: linkBoard, listId: linkList })}
                    className="shrink-0 px-2.5 py-1 text-xs rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Link
                  </button>
                </div>
                <p className="text-[11px] text-ink-faint">
                  This links a board to a Google Tasks list. The actual two-way syncing (add / edit / complete / delete
                  both ways) is being switched on in the next update.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
