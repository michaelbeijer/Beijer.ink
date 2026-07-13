import { useState, useMemo, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, ExternalLink, Plus } from 'lucide-react';
import type { Board, Card } from '../../types/board';
import { getCalendarCards, getBoard, getBoards, createCard, updateCard } from '../../api/boards';
import { getGoogleEvents, getGoogleStatus } from '../../api/google';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  monthGrid, monthLabel, addMonths, addDays, startOfWeek, startOfDay,
  weekRangeLabel, isoWeek, parseDue, sameDay, WEEKDAY_LABELS,
} from '../../utils/calendar';
import { CardModal } from './CardModal';

// Distinct, theme-agnostic palette for per-board colour-coding.
const BOARD_COLORS = [
  '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899',
  '#0ea5e9', '#84cc16', '#ef4444', '#eab308', '#14b8a6',
];

type CalMode = 'month' | 'week' | 'weeks';

// One thing shown on the calendar — a native Beijer.ink card OR a read-only
// external Google event. The UI treats them uniformly (a dated, colour-coded
// chip) but only native items open the editor; external ones open in Google.
interface DisplayItem {
  key: string;
  sourceId: string;     // boardId (native) | calendarId (Google) — the colour/filter key
  sourceName: string;
  color: string;
  title: string;
  date: Date | null;    // null only for native cards with no due date
  done: boolean;
  external: boolean;
  href?: string;        // Google event link
  card?: Card & { boardId: string }; // native, for opening the modal
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// A card's due date is stored as a timestamp; anchor it at local noon so it
// always lands on the intended calendar day regardless of timezone.
function toDueIso(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).toISOString();
}

function read(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

// ─── Mobile week ("aCalendar"-style) ─────────────────────────────────────
// A phone-friendly week: a density strip up top, then every day as an equal
// box in a fixed 2-col × 4-row column-major grid (Mon–Thu down the left,
// Fri–Sun + a mini-month down the right). A busy day scrolls inside its box,
// so the week never reflows. Ported from the old per-board CalendarView and
// adapted to the unified (all-boards + Google) DisplayItem model.
const MOBILE_WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Compact "how busy is each day" strip — a week-at-a-glance scrubber. */
function DensityStrip({
  weekDays, itemsForDay, today,
}: { weekDays: Date[]; itemsForDay: (d: Date) => DisplayItem[]; today: Date }) {
  return (
    <div className="flex gap-1 mb-3 shrink-0">
      {weekDays.map((d, i) => {
        const cs = itemsForDay(d);
        const isToday = sameDay(d, today);
        return (
          <div key={d.toISOString()} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-full h-9 rounded-md flex flex-col justify-end gap-0.5 p-1 ${
              isToday ? 'bg-accent/15 ring-1 ring-accent' : 'bg-muted-bg'}`}>
              {cs.slice(0, 4).map((c) => (
                <span key={c.key} className="h-1 rounded-full" style={{ background: c.color }} />
              ))}
            </div>
            <span className={`text-[10px] ${isToday ? 'text-accent font-semibold' : 'text-ink-muted'}`}>
              {MOBILE_WEEKDAY_LETTERS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Month picker for the 8th grid cell; tap a day jumps to its week. */
function MiniMonth({
  anchor, weekDays, onPickDay,
}: { anchor: Date; weekDays: Date[]; onPickDay: (d: Date) => void }) {
  const cells = monthGrid(anchor);
  const weekSet = new Set(weekDays.map((d) => d.toDateString()));
  return (
    <div className="flex flex-col min-h-0 overflow-hidden rounded-xl border border-edge bg-surface p-2">
      <div className="text-xs font-semibold text-ink mb-1 shrink-0">
        {anchor.toLocaleDateString(undefined, { month: 'long' })}
      </div>
      <div className="grid grid-cols-7 gap-px text-[10px] flex-1 min-h-0 content-start">
        {MOBILE_WEEKDAY_LETTERS.map((d, i) => (
          <div key={i} className="text-center text-ink-faint">{d}</div>
        ))}
        {cells.map((c) => {
          const inWeek = weekSet.has(c.date.toDateString());
          return (
            <button key={c.date.toISOString()} onClick={() => onPickDay(c.date)}
              className={`aspect-square flex items-center justify-center rounded ${
                c.isToday ? 'bg-accent text-white font-semibold'
                  : inWeek ? 'bg-accent/15 text-ink'
                  : !c.inMonth ? 'text-ink-faint'
                  : c.date.getDay() === 0 ? 'text-danger'
                  : 'text-ink-muted'}`}>
              {c.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A single day box in the mobile week grid. */
function MobileDay({
  date, items, isToday, overdue, dragActive, canAdd, renderItem, onDropDay, onAdd,
}: {
  date: Date;
  items: DisplayItem[];
  isToday: boolean;
  overdue: DisplayItem[];
  dragActive: boolean;
  canAdd: boolean;
  renderItem: (it: DisplayItem, showDate?: boolean) => ReactNode;
  onDropDay: (d: Date) => void;
  onAdd: (title: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [showOverdue, setShowOverdue] = useState(false);
  const isSunday = date.getDay() === 0;
  const isWeekend = isSunday || date.getDay() === 6;
  function submit() {
    const t = title.trim();
    if (t) onAdd(t);
    setTitle(''); setAdding(false);
  }
  return (
    <div
      onDragOver={(e) => { if (dragActive) e.preventDefault(); }}
      onDrop={() => onDropDay(date)}
      className={`flex flex-col min-h-0 overflow-hidden rounded-xl border p-2 ${
        isToday ? 'border-accent bg-accent/5 ring-1 ring-accent/40'
          : isWeekend ? 'border-edge bg-panel/60'
          : 'border-edge bg-surface'} ${dragActive ? 'hover:border-accent' : ''}`}>
      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className={`text-sm font-medium ${isSunday ? 'text-danger' : 'text-ink'}`}>
          {date.toLocaleDateString(undefined, { weekday: 'short' })} {date.getDate()}
        </span>
        <div className="flex items-center gap-1">
          {isToday && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-white">today</span>}
          {canAdd && (
            <button onClick={() => setAdding(true)} className="text-ink-faint hover:text-ink" title="Add card">
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isToday && overdue.length > 0 && (
        <button onClick={() => setShowOverdue((s) => !s)}
          className="w-full text-left px-2 py-0.5 mb-1 rounded bg-danger/15 text-danger text-[11px] font-medium shrink-0">
          {overdue.length}× overdue
        </button>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
        {isToday && showOverdue && overdue.map((it) => renderItem(it, true))}
        {items.map((it) => renderItem(it))}
        {adding && (
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') { setAdding(false); setTitle(''); }
            }}
            placeholder="Title…"
            className="w-full px-1 py-0.5 text-[11px] bg-input-bg border border-accent rounded text-ink outline-none" />
        )}
      </div>
    </div>
  );
}

interface UnifiedCalendarViewProps {
  onOpenNote: (noteId: string) => void;
}

export function UnifiedCalendarView({ onOpenNote }: UnifiedCalendarViewProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CalMode>(() => {
    // Respect an explicit stored choice; otherwise default phones to the (much
    // more usable) week view and desktops to month.
    const stored = read('bink:calendar:mode', '');
    if (stored === 'month' || stored === 'week' || stored === 'weeks') return stored;
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
    return mobile ? 'week' : 'month';
  });
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(read('bink:calendar:hidden', '[]'))); } catch { return new Set(); }
  });
  const [opening, setOpening] = useState(false);
  const [openCard, setOpenCard] = useState<{ board: Board; card: Card } | null>(null);
  // Card currently being dragged to a new day, and the board new "+" cards go to.
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [addBoardId, setAddBoardId] = useState<string>(() => read('bink:calendar:addBoard', ''));

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['calendar'],
    queryFn: () => getCalendarCards(),
  });
  // Read-only Google events (empty array when not connected/configured).
  const { data: googleEvents = [] } = useQuery({
    queryKey: ['google-events'],
    queryFn: () => getGoogleEvents(),
    staleTime: 60 * 1000,
  });
  // For the Google calendars' display names (events only carry the calendarId).
  const { data: googleStatus } = useQuery({
    queryKey: ['google-status'],
    queryFn: getGoogleStatus,
  });
  // Boards, for the "add new cards to →" target selector.
  const { data: boards = [] } = useQuery({ queryKey: ['boards'], queryFn: getBoards });

  function setModePref(m: CalMode) { setMode(m); write('bink:calendar:mode', m); }
  function toggleSource(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      write('bink:calendar:hidden', JSON.stringify([...next]));
      return next;
    });
  }

  // Stable palette colour per native board.
  const boardColor = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of cards) if (!seen.has(c.boardId)) seen.set(c.boardId, c.boardName);
    const list = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const m = new Map<string, string>();
    list.forEach(([id], i) => m.set(id, BOARD_COLORS[i % BOARD_COLORS.length]));
    return m;
  }, [cards]);

  const calName = useMemo(
    () => new Map((googleStatus?.calendars ?? []).map((c) => [c.calendarId, c.name])),
    [googleStatus]
  );

  // Native cards + external Google events as one uniform list.
  const items = useMemo<DisplayItem[]>(() => {
    const out: DisplayItem[] = [];
    for (const c of cards) {
      out.push({
        key: `c:${c.id}`,
        sourceId: c.boardId,
        sourceName: c.boardName,
        color: boardColor.get(c.boardId) ?? '#64748b',
        title: c.title,
        date: parseDue(c.dueDate),
        done: c.dueDone,
        external: false,
        card: c,
      });
    }
    for (const e of googleEvents) {
      out.push({
        key: `g:${e.id}`,
        sourceId: e.calendarId,
        sourceName: calName.get(e.calendarId) ?? 'Google',
        color: e.color || '#64748b',
        title: e.title,
        date: parseDue(e.start),
        done: false,
        external: true,
        href: e.htmlLink,
      });
    }
    return out;
  }, [cards, googleEvents, boardColor, calName]);

  // Distinct sources present (native boards + Google calendars) for the chips.
  const sources = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string; external: boolean }>();
    for (const it of items) {
      if (!seen.has(it.sourceId)) {
        seen.set(it.sourceId, { id: it.sourceId, name: it.sourceName, color: it.color, external: it.external });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  // Group visible items by local day.
  const byDay = useMemo(() => {
    const map = new Map<string, DisplayItem[]>();
    for (const it of items) {
      if (hidden.has(it.sourceId) || !it.date) continue;
      const k = dayKey(it.date);
      (map.get(k) ?? map.set(k, []).get(k)!).push(it);
    }
    return map;
  }, [items, hidden]);

  const days = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return monthGrid(anchor).map((c) => c.date);
  }, [mode, anchor]);

  // Weeks (kanban-by-week) arrangement: one column per ISO week with items,
  // plus a "No date" column — To-do, Earnings and Google side by side, by week.
  const weekData = useMemo(() => {
    const empty = {
      cols: [] as { key: string; label: string; sub: string; isThisWeek: boolean; items: DisplayItem[] }[],
      noDate: [] as DisplayItem[],
    };
    if (mode !== 'weeks') return empty;
    const map = new Map<number, { start: Date; items: DisplayItem[] }>();
    const noDate: DisplayItem[] = [];
    for (const it of items) {
      if (hidden.has(it.sourceId)) continue;
      if (!it.date) { noDate.push(it); continue; }
      const ws = startOfWeek(it.date);
      const key = ws.getTime();
      let bucket = map.get(key);
      if (!bucket) { bucket = { start: ws, items: [] }; map.set(key, bucket); }
      bucket.items.push(it);
    }
    const thisWeek = startOfWeek(startOfDay(new Date())).getTime();
    const cols = [...map.values()]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((w) => ({
        key: String(w.start.getTime()),
        label: `Week ${isoWeek(w.start)}`,
        sub: weekRangeLabel(w.start),
        isThisWeek: w.start.getTime() === thisWeek,
        items: w.items.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0)),
      }));
    return { cols, noDate };
  }, [mode, items, hidden]);

  const monthOfAnchor = anchor.getMonth();
  const today = startOfDay(new Date());
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Overdue = not-done native cards due in the recent past, rolled onto today's
  // box in the mobile week. Capped to ~3 weeks so a board full of back-dated log
  // entries doesn't surface as hundreds of "overdue" items.
  const OVERDUE_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;
  const overdue = items
    .filter((it) => {
      if (it.external || it.done || hidden.has(it.sourceId) || !it.date) return false;
      const behind = today.getTime() - startOfDay(it.date).getTime();
      return behind > 0 && behind <= OVERDUE_WINDOW_MS;
    })
    .sort((a, b) => (a.date!.getTime() - b.date!.getTime()));

  async function handleOpenCard(c: { id: string; boardId: string }) {
    setOpening(true);
    try {
      const board = await getBoard(c.boardId);
      const card = board.columns.flatMap((col) => col.cards).find((x) => x.id === c.id);
      if (card) setOpenCard({ board, card });
    } finally {
      setOpening(false);
    }
  }

  function closeCard() {
    setOpenCard(null);
    queryClient.invalidateQueries({ queryKey: ['calendar'] });
  }

  // The board that inline "+ New card" additions go to (remembered; falls back
  // to the first board if the stored one is gone).
  const targetBoardId = addBoardId && boards.some((b) => b.id === addBoardId) ? addBoardId : (boards[0]?.id ?? '');
  function chooseAddBoard(id: string) { setAddBoardId(id); write('bink:calendar:addBoard', id); }

  // Drag a native card onto a day (or the No-date column) to reschedule it.
  const rescheduleMutation = useMutation({
    mutationFn: (v: { cardId: string; dueDate: string | null }) => updateCard(v.cardId, { dueDate: v.dueDate }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });
  // Quick-add a dated card to the target board's first column.
  const addCardMutation = useMutation({
    mutationFn: async (v: { boardId: string; title: string; date: Date }) => {
      const board = await getBoard(v.boardId);
      const col = board.columns[0];
      if (!col) throw new Error('That board has no lists to add a card to.');
      const card = await createCard(col.id, v.title);
      await updateCard(card.id, { dueDate: toDueIso(v.date) });
      return card;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });

  function dropOn(date: Date | null) {
    if (dragCardId) rescheduleMutation.mutate({ cardId: dragCardId, dueDate: date ? toDueIso(date) : null });
    setDragCardId(null);
  }
  function addOn(date: Date) {
    if (!targetBoardId) return;
    const title = window.prompt('New card:');
    if (title && title.trim()) addCardMutation.mutate({ boardId: targetBoardId, title: title.trim(), date });
  }
  // Inline add (mobile week) — no prompt; the day box supplies the title.
  function addInline(date: Date, title: string) {
    if (!targetBoardId || !title.trim()) return;
    addCardMutation.mutate({ boardId: targetBoardId, title: title.trim(), date });
  }

  // One chip, colour-coded by source (left border). Native items open the
  // editor; external (Google) items open in Google and show a link glyph.
  const renderItem = (it: DisplayItem, showDate = false) => {
    const onClick = it.external
      ? () => { if (it.href) window.open(it.href, '_blank', 'noopener,noreferrer'); }
      : () => it.card && handleOpenCard(it.card);
    return (
      <button key={it.key} onClick={onClick} disabled={!it.external && opening}
        draggable={!it.external}
        onDragStart={it.external ? undefined : () => { if (it.card) setDragCardId(it.card.id); }}
        onDragEnd={() => setDragCardId(null)}
        title={`${it.sourceName}: ${it.title}${it.done ? ' (done)' : ''}${it.external ? ' · Google (read-only)' : ' · drag to reschedule'}`}
        className={`w-full text-left text-[11px] leading-snug px-1.5 py-1 rounded bg-surface border border-edge hover:border-accent block ${it.external ? '' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ borderLeft: `3px solid ${it.color}` }}>
        <span className="flex items-center gap-1">
          <span className={`flex-1 truncate ${it.done ? 'line-through text-ink-faint' : 'text-ink'}`}>{it.title || '(untitled)'}</span>
          {it.external && <ExternalLink className="w-3 h-3 text-ink-faint shrink-0" />}
        </span>
        {showDate && it.date && (
          <span className="block text-[10px] text-ink-faint">{it.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        )}
      </button>
    );
  };

  const periodLabel = mode === 'week'
    ? `${weekRangeLabel(anchor)} · Week ${isoWeek(anchor)}`
    : monthLabel(anchor);

  function shift(dir: number) {
    setAnchor((a) => (mode === 'week' ? addDays(a, dir * 7) : addMonths(a, dir)));
  }

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-edge shrink-0">
        <CalendarDays className="w-5 h-5 text-accent shrink-0" />
        <h2 className="text-lg font-semibold text-ink">Calendar</h2>
        <span className="text-sm text-ink-muted ml-1">all boards</span>

        <div className="flex-1" />

        {/* Month/Week grids navigate by period; the Weeks arrangement shows
            every week with content at once, so it has no period nav. */}
        {mode !== 'weeks' && (
          <>
            <button onClick={() => setAnchor(startOfDay(new Date()))}
              className="px-2.5 py-1 text-sm text-ink-muted hover:text-ink hover:bg-hover rounded-md">Today</button>
            <button onClick={() => shift(-1)} className="p-1 text-ink-muted hover:text-ink hover:bg-hover rounded-md" title="Previous">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-ink min-w-[10rem] text-center">{periodLabel}</span>
            <button onClick={() => shift(1)} className="p-1 text-ink-muted hover:text-ink hover:bg-hover rounded-md" title="Next">
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="ml-2 flex rounded-md border border-edge overflow-hidden">
          {(['month', 'week', 'weeks'] as CalMode[]).map((m) => (
            <button key={m} onClick={() => setModePref(m)}
              className={`px-2.5 py-1 text-sm capitalize ${mode === m ? 'bg-accent text-white' : 'text-ink-muted hover:bg-hover'}`}
              title={m === 'weeks' ? 'Kanban-by-week across all boards' : `${m} view`}>
              {m}
            </button>
          ))}
        </div>

        {boards.length > 0 && (
          <select value={targetBoardId} onChange={(e) => chooseAddBoard(e.target.value)}
            title="New cards added from the calendar (the + on a day) go to this board"
            className="ml-2 text-xs bg-input-bg border border-edge rounded px-1.5 py-1 text-ink-muted max-w-[9rem]">
            {boards.map((b) => <option key={b.id} value={b.id}>+ {b.name}</option>)}
          </select>
        )}
      </div>

      {/* Source filter chips (boards + Google calendars) */}
      {sources.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap px-5 py-2 border-b border-edge shrink-0">
          {sources.map((s) => {
            const off = hidden.has(s.id);
            return (
              <button key={s.id} onClick={() => toggleSource(s.id)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                  off ? 'border-edge text-ink-faint bg-transparent' : 'border-transparent text-ink bg-muted-bg'}`}
                title={off ? `Show ${s.name}` : `Hide ${s.name}`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: off ? 'transparent' : s.color, border: `1.5px solid ${s.color}` }} />
                {s.name}
                {s.external && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-ink-muted gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading calendar…
          </div>
        ) : isMobile && mode === 'week' ? (
          <div className="h-full flex flex-col">
            <div className="text-[11px] text-ink-muted mb-2 shrink-0">
              wk {isoWeek(anchor)} · {days[0].getDate()}–{days[6].getDate()}
            </div>
            <DensityStrip weekDays={days} itemsForDay={(d) => byDay.get(dayKey(d)) ?? []} today={today} />
            {/* Fixed week shape: 2 cols × 4 rows, filled column-major (Mon–Thu
                left, Fri–Sun + mini-month right). Each day is an equal box. */}
            <div className="grid grid-cols-2 grid-rows-4 grid-flow-col gap-2 flex-1 min-h-0">
              {days.map((date) => (
                <MobileDay
                  key={dayKey(date)}
                  date={date}
                  items={byDay.get(dayKey(date)) ?? []}
                  isToday={sameDay(date, today)}
                  overdue={overdue}
                  dragActive={!!dragCardId}
                  canAdd={!!targetBoardId}
                  renderItem={renderItem}
                  onDropDay={dropOn}
                  onAdd={(t) => addInline(date, t)}
                />
              ))}
              <MiniMonth anchor={anchor} weekDays={days} onPickDay={(d) => setAnchor(startOfDay(d))} />
            </div>
          </div>
        ) : mode === 'weeks' ? (
          weekData.cols.length === 0 && weekData.noDate.length === 0 ? (
            <p className="text-center text-sm text-ink-muted py-12">
              No dated items yet. Give a card a due date on any board (or connect Google Calendar) and it'll appear here.
            </p>
          ) : (
            <div className="flex gap-2 h-full overflow-x-auto pb-2">
              {weekData.noDate.length > 0 && (
                <div
                  onDragOver={(e) => { if (dragCardId) e.preventDefault(); }}
                  onDrop={() => dropOn(null)}
                  className={`flex flex-col w-64 shrink-0 rounded-lg border bg-card p-2 ${dragCardId ? 'border-accent' : 'border-edge'}`}>
                  <div className="flex items-baseline justify-between mb-2 px-0.5 shrink-0">
                    <span className="text-sm font-medium text-ink">No date</span>
                    <span className="text-xs text-ink-faint">{weekData.noDate.length}</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
                    {weekData.noDate.map((it) => renderItem(it, true))}
                  </div>
                </div>
              )}
              {weekData.cols.map((col) => (
                <div key={col.key}
                  onDragOver={(e) => { if (dragCardId) e.preventDefault(); }}
                  onDrop={() => dropOn(new Date(Number(col.key)))}
                  className={`flex flex-col w-64 shrink-0 rounded-lg border p-2 ${col.isThisWeek ? 'border-accent bg-accent/5' : dragCardId ? 'border-accent bg-card' : 'border-edge bg-card'}`}>
                  <div className="flex items-baseline justify-between px-0.5 shrink-0">
                    <span className={`text-sm font-medium ${col.isThisWeek ? 'text-accent' : 'text-ink'}`}>{col.label}</span>
                    <span className="text-xs text-ink-faint">{col.items.length}</span>
                  </div>
                  <div className="text-[11px] text-ink-faint mb-2 px-0.5 shrink-0">{col.sub}</div>
                  <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
                    {col.items.map((it) => renderItem(it, true))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} className="text-[11px] font-medium text-ink-muted text-center py-1">{w}</div>
              ))}
            </div>
            <div className={`grid grid-cols-7 gap-1 ${mode === 'week' ? 'h-[calc(100%-2rem)]' : ''}`}>
              {days.map((date) => {
                const inMonth = mode === 'week' || date.getMonth() === monthOfAnchor;
                const isToday = date.getTime() === today.getTime();
                const dayItems = byDay.get(dayKey(date)) ?? [];
                return (
                  <div key={dayKey(date)}
                    onDragOver={(e) => { if (dragCardId) e.preventDefault(); }}
                    onDrop={() => dropOn(date)}
                    className={`group flex flex-col rounded-lg border p-1.5 ${mode === 'week' ? 'min-h-0' : 'min-h-[6.5rem]'} ${
                      isToday ? 'border-accent bg-accent/5' : 'border-edge'} ${inMonth ? 'bg-card' : 'bg-panel/40'} ${dragCardId ? 'hover:border-accent hover:bg-accent/5' : ''}`}>
                    <div className={`flex items-center justify-between text-xs mb-1 shrink-0 ${isToday ? 'font-semibold text-accent' : inMonth ? 'text-ink' : 'text-ink-faint'}`}>
                      <span>
                        {mode === 'week' && <span className="mr-1">{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>}
                        {date.getDate()}
                      </span>
                      {targetBoardId && (
                        <button onClick={() => addOn(date)} title="Add a card on this day"
                          className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-accent transition-opacity">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
                      {dayItems.map((it) => renderItem(it))}
                    </div>
                  </div>
                );
              })}
            </div>
            {sources.length === 0 && (
              <p className="text-center text-sm text-ink-muted py-12">
                No dated items yet. Give a card a due date on any board (or connect Google Calendar) and it'll appear here.
              </p>
            )}
          </>
        )}
      </div>

      {openCard && (
        <CardModal
          board={openCard.board}
          card={openCard.card}
          onClose={closeCard}
          onOpenNote={(noteId) => { closeCard(); onOpenNote(noteId); }}
        />
      )}
    </div>
  );
}
