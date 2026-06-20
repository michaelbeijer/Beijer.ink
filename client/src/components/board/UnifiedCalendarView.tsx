import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from 'lucide-react';
import type { CalendarCard, Board, Card } from '../../types/board';
import { getCalendarCards, getBoard } from '../../api/boards';
import {
  monthGrid, monthLabel, addMonths, addDays, startOfWeek, startOfDay,
  weekRangeLabel, isoWeek, parseDue, WEEKDAY_LABELS,
} from '../../utils/calendar';
import { CardModal } from './CardModal';

// Distinct, theme-agnostic palette for per-board colour-coding.
const BOARD_COLORS = [
  '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899',
  '#0ea5e9', '#84cc16', '#ef4444', '#eab308', '#14b8a6',
];

type CalMode = 'month' | 'week' | 'weeks';

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function read(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

interface UnifiedCalendarViewProps {
  onOpenNote: (noteId: string) => void;
}

export function UnifiedCalendarView({ onOpenNote }: UnifiedCalendarViewProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CalMode>(() => (read('bink:calendar:mode', 'month') as CalMode));
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(read('bink:calendar:hidden', '[]'))); } catch { return new Set(); }
  });
  const [opening, setOpening] = useState(false);
  const [openCard, setOpenCard] = useState<{ board: Board; card: Card } | null>(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['calendar'],
    queryFn: () => getCalendarCards(),
  });

  function setModePref(m: CalMode) { setMode(m); write('bink:calendar:mode', m); }
  function toggleBoard(boardId: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(boardId)) next.delete(boardId); else next.add(boardId);
      write('bink:calendar:hidden', JSON.stringify([...next]));
      return next;
    });
  }

  // Distinct boards present in the dated cards, with a stable colour each.
  const boards = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of cards) if (!seen.has(c.boardId)) seen.set(c.boardId, c.boardName);
    const list = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    return list.map(([id, name], i) => ({ id, name, color: BOARD_COLORS[i % BOARD_COLORS.length] }));
  }, [cards]);
  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of boards) m.set(b.id, b.color);
    return m;
  }, [boards]);

  // Group visible cards by local day.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarCard[]>();
    for (const c of cards) {
      if (hidden.has(c.boardId)) continue;
      const d = parseDue(c.dueDate);
      if (!d) continue;
      const k = dayKey(d);
      (map.get(k) ?? map.set(k, []).get(k)!).push(c);
    }
    return map;
  }, [cards, hidden]);

  const days = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return monthGrid(anchor).map((c) => c.date);
  }, [mode, anchor]);

  // Weeks (kanban-by-week) arrangement: one column per ISO week that has
  // cards, plus a "No date" column — your To-do, Earnings, and (later) Google
  // items side by side, by week, across every board.
  const weekData = useMemo(() => {
    const empty = {
      cols: [] as { key: string; label: string; sub: string; isThisWeek: boolean; cards: CalendarCard[] }[],
      noDate: [] as CalendarCard[],
    };
    if (mode !== 'weeks') return empty;
    const map = new Map<number, { start: Date; cards: CalendarCard[] }>();
    const noDate: CalendarCard[] = [];
    for (const c of cards) {
      if (hidden.has(c.boardId)) continue;
      const d = parseDue(c.dueDate);
      if (!d) { noDate.push(c); continue; }
      const ws = startOfWeek(d);
      const key = ws.getTime();
      let bucket = map.get(key);
      if (!bucket) { bucket = { start: ws, cards: [] }; map.set(key, bucket); }
      bucket.cards.push(c);
    }
    const thisWeek = startOfWeek(startOfDay(new Date())).getTime();
    const cols = [...map.values()]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((w) => ({
        key: String(w.start.getTime()),
        label: `Week ${isoWeek(w.start)}`,
        sub: weekRangeLabel(w.start),
        isThisWeek: w.start.getTime() === thisWeek,
        cards: w.cards.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
      }));
    return { cols, noDate };
  }, [mode, cards, hidden]);

  const monthOfAnchor = anchor.getMonth();
  const today = startOfDay(new Date());

  async function handleOpenCard(c: CalendarCard) {
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

  // One card chip, colour-coded by its board (left border). `showDate` adds the
  // day under the title — useful in the Weeks columns where a column spans 7 days.
  const renderCard = (c: CalendarCard, showDate = false) => {
    const d = showDate ? parseDue(c.dueDate) : null;
    return (
      <button key={c.id} onClick={() => handleOpenCard(c)} disabled={opening}
        title={`${c.boardName}: ${c.title}${c.dueDone ? ' (done)' : ''}`}
        className="w-full text-left text-[11px] leading-snug px-1.5 py-1 rounded bg-surface border border-edge hover:border-accent block"
        style={{ borderLeft: `3px solid ${colorOf.get(c.boardId) ?? '#64748b'}` }}>
        <span className={`block truncate ${c.dueDone ? 'line-through text-ink-faint' : 'text-ink'}`}>{c.title || '(untitled)'}</span>
        {d && <span className="block text-[10px] text-ink-faint">{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
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
      </div>

      {/* Board filter chips */}
      {boards.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap px-5 py-2 border-b border-edge shrink-0">
          {boards.map((b) => {
            const off = hidden.has(b.id);
            return (
              <button key={b.id} onClick={() => toggleBoard(b.id)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                  off ? 'border-edge text-ink-faint bg-transparent' : 'border-transparent text-ink bg-muted-bg'}`}
                title={off ? `Show ${b.name}` : `Hide ${b.name}`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: off ? 'transparent' : b.color, border: `1.5px solid ${b.color}` }} />
                {b.name}
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
        ) : mode === 'weeks' ? (
          weekData.cols.length === 0 && weekData.noDate.length === 0 ? (
            <p className="text-center text-sm text-ink-muted py-12">
              No dated cards yet. Give a card a due date on any board and it'll appear here.
            </p>
          ) : (
            <div className="flex gap-2 h-full overflow-x-auto pb-2">
              {weekData.noDate.length > 0 && (
                <div className="flex flex-col w-64 shrink-0 rounded-lg border border-edge bg-card p-2">
                  <div className="flex items-baseline justify-between mb-2 px-0.5 shrink-0">
                    <span className="text-sm font-medium text-ink">No date</span>
                    <span className="text-xs text-ink-faint">{weekData.noDate.length}</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
                    {weekData.noDate.map((c) => renderCard(c, true))}
                  </div>
                </div>
              )}
              {weekData.cols.map((col) => (
                <div key={col.key}
                  className={`flex flex-col w-64 shrink-0 rounded-lg border p-2 ${col.isThisWeek ? 'border-accent bg-accent/5' : 'border-edge bg-card'}`}>
                  <div className="flex items-baseline justify-between px-0.5 shrink-0">
                    <span className={`text-sm font-medium ${col.isThisWeek ? 'text-accent' : 'text-ink'}`}>{col.label}</span>
                    <span className="text-xs text-ink-faint">{col.cards.length}</span>
                  </div>
                  <div className="text-[11px] text-ink-faint mb-2 px-0.5 shrink-0">{col.sub}</div>
                  <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
                    {col.cards.map((c) => renderCard(c, true))}
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
                const dayCards = byDay.get(dayKey(date)) ?? [];
                return (
                  <div key={dayKey(date)}
                    className={`flex flex-col rounded-lg border p-1.5 ${mode === 'week' ? 'min-h-0' : 'min-h-[6.5rem]'} ${
                      isToday ? 'border-accent bg-accent/5' : 'border-edge'} ${inMonth ? 'bg-card' : 'bg-panel/40'}`}>
                    <div className={`text-xs mb-1 shrink-0 ${isToday ? 'font-semibold text-accent' : inMonth ? 'text-ink' : 'text-ink-faint'}`}>
                      {mode === 'week' && <span className="mr-1">{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>}
                      {date.getDate()}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
                      {dayCards.map((c) => renderCard(c))}
                    </div>
                  </div>
                );
              })}
            </div>
            {boards.length === 0 && (
              <p className="text-center text-sm text-ink-muted py-12">
                No dated cards yet. Give a card a due date on any board and it'll appear here.
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
