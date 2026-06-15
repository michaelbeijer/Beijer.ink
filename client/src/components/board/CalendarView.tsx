import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  useSensors,
  useSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Board, Card, Label } from '../../types/board';
import { LABEL_COLORS } from '../../types/board';
import type { CalendarMode } from '../../hooks/useBoardViewPrefs';
import { useBoardCardMutations } from '../../hooks/useBoardCardMutations';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  monthGrid,
  monthLabel,
  addMonths,
  addDays,
  startOfWeek,
  weekLabel,
  weekRangeLabel,
  isoWeek,
  parseDue,
  sameDay,
  startOfDay,
  dayToISO,
  WEEKDAY_LABELS,
} from '../../utils/calendar';

interface CalendarViewProps {
  board: Board;
  onOpenCard: (cardId: string) => void;
  mode: CalendarMode;
  onModeChange: (m: CalendarMode) => void;
}

function CalCard({ card, labels, onClick }: { card: Card; labels: Label[]; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { cardId: card.id },
  });
  const firstLabel = card.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .find((l): l is Label => Boolean(l));
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-card border border-edge text-[11px] text-ink truncate cursor-pointer hover:border-ink-dim select-none"
    >
      {firstLabel && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: LABEL_COLORS[firstLabel.color] ?? firstLabel.color }}
        />
      )}
      <span className={`truncate ${card.dueDone ? 'line-through text-ink-faint' : ''}`}>
        {card.title || 'Untitled'}
      </span>
    </div>
  );
}

function InlineAdd({ onAdd, onCancel }: { onAdd: (t: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  function submit() {
    const t = title.trim();
    if (t) onAdd(t);
    onCancel();
  }
  return (
    <input
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') onCancel();
      }}
      placeholder="Title…"
      className="w-full px-1 py-0.5 text-[11px] bg-input-bg border border-accent rounded text-ink outline-none"
    />
  );
}

/** Month-grid cell. */
function DayCell({
  date,
  inMonth,
  isToday,
  cards,
  labels,
  onOpenCard,
  onAdd,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  cards: Card[];
  labels: Label[];
  onOpenCard: (id: string) => void;
  onAdd: (title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayToISO(date), data: { date } });
  const [adding, setAdding] = useState(false);
  return (
    <div
      ref={setNodeRef}
      className={`group flex flex-col min-h-24 border-b border-r border-edge p-1 ${
        inMonth ? 'bg-surface' : 'bg-panel/40'
      } ${isOver ? 'bg-accent/10' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs px-1 rounded ${
            isToday ? 'bg-accent text-white font-semibold' : inMonth ? 'text-ink-muted' : 'text-ink-faint'
          }`}
        >
          {date.getDate()}
        </span>
        <button
          onClick={() => setAdding(true)}
          className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-ink transition-opacity"
          title="Add card"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-col gap-0.5 mt-0.5">
        {cards.map((card) => (
          <CalCard key={card.id} card={card} labels={labels} onClick={() => onOpenCard(card.id)} />
        ))}
      </div>
      {adding && (
        <div className="mt-1">
          <InlineAdd onAdd={onAdd} onCancel={() => setAdding(false)} />
        </div>
      )}
    </div>
  );
}

/** Week-mode day column (taller; days laid out horizontally Mon→Sun). */
function DayColumn({
  date,
  isToday,
  cards,
  labels,
  onOpenCard,
  onAdd,
}: {
  date: Date;
  isToday: boolean;
  cards: Card[];
  labels: Label[];
  onOpenCard: (id: string) => void;
  onAdd: (title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayToISO(date), data: { date } });
  const [adding, setAdding] = useState(false);
  return (
    <div
      ref={setNodeRef}
      className={`group flex flex-col flex-1 min-w-0 border-r border-edge ${
        isOver ? 'bg-accent/10' : ''
      }`}
    >
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-edge bg-panel">
        <span className={`text-xs ${isToday ? 'text-accent font-semibold' : 'text-ink-muted'}`}>
          {date.toLocaleDateString(undefined, { weekday: 'short' })} {date.getDate()}
        </span>
        <button
          onClick={() => setAdding(true)}
          className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-ink transition-opacity"
          title="Add card"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1">
        {cards.map((card) => (
          <CalCard key={card.id} card={card} labels={labels} onClick={() => onOpenCard(card.id)} />
        ))}
        {adding && <InlineAdd onAdd={onAdd} onCancel={() => setAdding(false)} />}
      </div>
    </div>
  );
}

function firstLabelHex(card: Card, labels: Label[]): string {
  const l = card.labelIds.map((id) => labels.find((x) => x.id === id)).find((x): x is Label => Boolean(x));
  return l ? LABEL_COLORS[l.color] ?? l.color : 'var(--color-accent)';
}

const MOBILE_WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Compact "how busy is each day" strip — a left-to-right week scrubber. */
function DensityStrip({
  weekDays,
  cardsForDay,
  labels,
  today,
}: {
  weekDays: Date[];
  cardsForDay: (d: Date) => Card[];
  labels: Label[];
  today: Date;
}) {
  return (
    <div className="flex gap-1 mb-3">
      {weekDays.map((d, i) => {
        const cs = cardsForDay(d);
        const isToday = sameDay(d, today);
        return (
          <div key={d.toISOString()} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full h-9 rounded-md flex flex-col justify-end gap-0.5 p-1 ${
                isToday ? 'bg-accent/15 ring-1 ring-accent' : 'bg-muted-bg'
              }`}
            >
              {cs.slice(0, 4).map((c) => (
                <span key={c.id} className="h-1 rounded-full" style={{ background: firstLabelHex(c, labels) }} />
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

/** A single day box in the mobile week grid. */
function MobileDayBox({
  date,
  cards,
  labels,
  isToday,
  overdue,
  onOpenCard,
  onAdd,
}: {
  date: Date;
  cards: Card[];
  labels: Label[];
  isToday: boolean;
  overdue: Card[];
  onOpenCard: (id: string) => void;
  onAdd: (title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayToISO(date), data: { date } });
  const [adding, setAdding] = useState(false);
  const [showOverdue, setShowOverdue] = useState(false);
  const isSunday = date.getDay() === 0;
  const isWeekend = isSunday || date.getDay() === 6;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-2 ${
        isToday
          ? 'border-accent bg-accent/5 ring-1 ring-accent/40'
          : isWeekend
          ? 'border-edge bg-panel/60'
          : 'border-edge bg-surface'
      } ${isOver ? 'bg-accent/10' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-medium ${isSunday ? 'text-danger' : 'text-ink'}`}>
          {date.toLocaleDateString(undefined, { weekday: 'short' })} {date.getDate()}
        </span>
        <div className="flex items-center gap-1">
          {isToday && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-white">today</span>
          )}
          <button onClick={() => setAdding(true)} className="text-ink-faint hover:text-ink" title="Add card">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isToday && overdue.length > 0 && (
        <button
          onClick={() => setShowOverdue((s) => !s)}
          className="w-full text-left px-2 py-0.5 mb-1 rounded bg-danger/15 text-danger text-[11px] font-medium"
        >
          {overdue.length}× overdue
        </button>
      )}

      <div className="flex flex-col gap-1">
        {isToday &&
          showOverdue &&
          overdue.map((card) => (
            <CalCard key={`od-${card.id}`} card={card} labels={labels} onClick={() => onOpenCard(card.id)} />
          ))}
        {cards.map((card) => (
          <CalCard key={card.id} card={card} labels={labels} onClick={() => onOpenCard(card.id)} />
        ))}
        {adding && <InlineAdd onAdd={onAdd} onCancel={() => setAdding(false)} />}
      </div>
    </div>
  );
}

/** Compact month picker for the 8th grid cell; tap a day jumps to its week. */
function MiniMonth({
  anchor,
  weekDays,
  onPickDay,
}: {
  anchor: Date;
  weekDays: Date[];
  onPickDay: (d: Date) => void;
}) {
  const cells = monthGrid(anchor);
  const weekSet = new Set(weekDays.map((d) => d.toDateString()));
  return (
    <div className="rounded-xl border border-edge bg-surface p-2">
      <div className="text-xs font-semibold text-ink mb-1">
        {anchor.toLocaleDateString(undefined, { month: 'long' })}
      </div>
      <div className="grid grid-cols-7 gap-px text-[10px]">
        {MOBILE_WEEKDAY_LETTERS.map((d, i) => (
          <div key={i} className="text-center text-ink-faint">
            {d}
          </div>
        ))}
        {cells.map((c) => {
          const inWeek = weekSet.has(c.date.toDateString());
          return (
            <button
              key={c.date.toISOString()}
              onClick={() => onPickDay(c.date)}
              className={`aspect-square flex items-center justify-center rounded ${
                c.isToday
                  ? 'bg-accent text-white font-semibold'
                  : inWeek
                  ? 'bg-accent/15 text-ink'
                  : !c.inMonth
                  ? 'text-ink-faint'
                  : c.date.getDay() === 0
                  ? 'text-danger'
                  : 'text-ink-muted'
              }`}
            >
              {c.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** aCalendar-style mobile week: density strip + column-major 2-col day grid + mini-month. */
function MobileWeek({
  anchor,
  weekDays,
  cardsForDay,
  overdue,
  labels,
  today,
  onOpenCard,
  onAddDay,
  onPickDay,
}: {
  anchor: Date;
  weekDays: Date[];
  cardsForDay: (d: Date) => Card[];
  overdue: Card[];
  labels: Label[];
  today: Date;
  onOpenCard: (id: string) => void;
  onAddDay: (date: Date, title: string) => void;
  onPickDay: (d: Date) => void;
}) {
  const dayBox = (date: Date) => (
    <MobileDayBox
      key={date.toISOString()}
      date={date}
      cards={cardsForDay(date)}
      labels={labels}
      isToday={sameDay(date, today)}
      overdue={overdue}
      onOpenCard={onOpenCard}
      onAdd={(t) => onAddDay(date, t)}
    />
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="text-[11px] text-ink-muted mb-2">
        wk {isoWeek(anchor)} · {weekDays[0].getDate()}–{weekDays[6].getDate()}
      </div>
      <DensityStrip weekDays={weekDays} cardsForDay={cardsForDay} labels={labels} today={today} />
      <div className="flex gap-2 items-start pb-4">
        {/* Left column: Mon–Thu */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">{weekDays.slice(0, 4).map(dayBox)}</div>
        {/* Right column: Fri–Sun + mini-month */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {weekDays.slice(4, 7).map(dayBox)}
          <MiniMonth anchor={anchor} weekDays={weekDays} onPickDay={onPickDay} />
        </div>
      </div>
    </div>
  );
}

export function CalendarView({ board, onOpenCard, mode, onModeChange }: CalendarViewProps) {
  const { setCardDate, addCard } = useBoardCardMutations(board.id);
  const [anchor, setAnchor] = useState(() => new Date());
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const allCards = useMemo(() => board.columns.flatMap((c) => c.cards), [board.columns]);
  const defaultColumnId = board.columns[0]?.id;
  const isMobile = useMediaQuery('(max-width: 767px)');

  const monthCells = useMemo(() => monthGrid(anchor), [anchor]);
  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  function cardsForDay(date: Date): Card[] {
    return allCards.filter((c) => {
      const due = parseDue(c.dueDate);
      return due && sameDay(due, date);
    });
  }

  function navigate(dir: -1 | 1) {
    setAnchor((a) => (mode === 'month' ? addMonths(a, dir) : addDays(a, dir * 7)));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveCardId(null);
    const { active, over } = e;
    if (!over) return;
    const date = over.data.current?.date as Date | undefined;
    if (!date) return;
    setCardDate(String(active.id), dayToISO(date));
  }

  const today = startOfDay(new Date());
  // Overdue = not-done cards whose date is before today (rolled onto today in the mobile week).
  const overdue = allCards
    .filter((c) => {
      const d = parseDue(c.dueDate);
      return d && !c.dueDone && d.getTime() < today.getTime();
    })
    .sort((a, b) => parseDue(a.dueDate)!.getTime() - parseDue(b.dueDate)!.getTime());
  const activeCard = allCards.find((c) => c.id === activeCardId);
  const label = mode === 'month' ? monthLabel(anchor) : `${weekLabel(anchor)} · ${weekRangeLabel(anchor)}`;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setActiveCardId(String(e.active.id))}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 min-h-0 flex flex-col p-4">
        {/* Header: mode toggle + nav */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-0.5 bg-muted-bg rounded-lg p-0.5 mr-1">
            {(['month', 'week'] as CalendarMode[]).map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                className={`px-2.5 py-1 text-sm rounded-md capitalize transition-colors ${
                  mode === m ? 'bg-card text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {m === 'month' ? 'Monthly' : 'Weekly'}
              </button>
            ))}
          </div>
          <h3 className="text-base font-semibold text-ink">{label}</h3>
          <div className="flex items-center gap-0.5 ml-2">
            <button onClick={() => navigate(-1)} className="p-1 text-ink-muted hover:text-ink hover:bg-hover rounded">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              className="px-2 py-1 text-xs text-ink-muted hover:text-ink hover:bg-hover rounded"
            >
              Today
            </button>
            <button onClick={() => navigate(1)} className="p-1 text-ink-muted hover:text-ink hover:bg-hover rounded">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {mode === 'month' ? (
          <>
            <div className="grid grid-cols-7 border-t border-l border-edge">
              {WEEKDAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="text-[11px] font-medium text-ink-muted px-2 py-1 border-b border-r border-edge bg-panel"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-l border-edge flex-1 min-h-0 overflow-y-auto auto-rows-fr">
              {monthCells.map((cell) => (
                <DayCell
                  key={cell.date.toISOString()}
                  date={cell.date}
                  inMonth={cell.inMonth}
                  isToday={cell.isToday}
                  cards={cardsForDay(cell.date)}
                  labels={board.labels}
                  onOpenCard={onOpenCard}
                  onAdd={(t) => defaultColumnId && addCard(defaultColumnId, t, dayToISO(cell.date))}
                />
              ))}
            </div>
          </>
        ) : isMobile ? (
          <MobileWeek
            anchor={anchor}
            weekDays={weekDays}
            cardsForDay={cardsForDay}
            overdue={overdue}
            labels={board.labels}
            today={today}
            onOpenCard={onOpenCard}
            onAddDay={(date, t) => defaultColumnId && addCard(defaultColumnId, t, dayToISO(date))}
            onPickDay={(d) => setAnchor(d)}
          />
        ) : (
          <div className="flex flex-1 min-h-0 border-t border-l border-edge">
            {weekDays.map((date) => (
              <DayColumn
                key={date.toISOString()}
                date={date}
                isToday={sameDay(date, today)}
                cards={cardsForDay(date)}
                labels={board.labels}
                onOpenCard={onOpenCard}
                onAdd={(t) => defaultColumnId && addCard(defaultColumnId, t, dayToISO(date))}
              />
            ))}
          </div>
        )}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="px-1.5 py-0.5 rounded bg-card border border-edge text-[11px] text-ink shadow-lg">
            {activeCard.title || 'Untitled'}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
