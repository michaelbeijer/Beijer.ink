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
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import type { Board, Card, Label } from '../../types/board';
import { LABEL_COLORS } from '../../types/board';
import { useBoardCardMutations } from '../../hooks/useBoardCardMutations';
import {
  monthGrid,
  monthLabel,
  addMonths,
  parseDue,
  sameDay,
  dayToISO,
  WEEKDAY_LABELS,
} from '../../utils/calendar';

interface CalendarViewProps {
  board: Board;
  onOpenCard: (cardId: string) => void;
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
  const [title, setTitle] = useState('');

  function submit() {
    const t = title.trim();
    if (t) onAdd(t);
    setTitle('');
    setAdding(false);
  }

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
            isToday
              ? 'bg-accent text-white font-semibold'
              : inMonth
              ? 'text-ink-muted'
              : 'text-ink-faint'
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
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') {
                setAdding(false);
                setTitle('');
              }
            }}
            placeholder="Title…"
            className="w-full px-1 py-0.5 text-[11px] bg-input-bg border border-accent rounded text-ink outline-none"
          />
        </div>
      )}
    </div>
  );
}

export function CalendarView({ board, onOpenCard }: CalendarViewProps) {
  const { setCardDate, addCard } = useBoardCardMutations(board.id);
  const [month, setMonth] = useState(() => new Date());
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const cells = useMemo(() => monthGrid(month), [month]);
  const allCards = useMemo(() => board.columns.flatMap((c) => c.cards), [board.columns]);
  const defaultColumnId = board.columns[0]?.id;

  function cardsForDay(date: Date): Card[] {
    return allCards.filter((c) => {
      const due = parseDue(c.dueDate);
      return due && sameDay(due, date);
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveCardId(null);
    const { active, over } = e;
    if (!over) return;
    const date = over.data.current?.date as Date | undefined;
    if (!date) return;
    setCardDate(String(active.id), dayToISO(date));
  }

  const activeCard = allCards.find((c) => c.id === activeCardId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setActiveCardId(String(e.active.id))}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 min-h-0 flex flex-col p-4">
        {/* Month nav */}
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base font-semibold text-ink">{monthLabel(month)}</h3>
          <div className="flex items-center gap-0.5 ml-2">
            <button
              onClick={() => setMonth((m) => addMonths(m, -1))}
              className="p-1 text-ink-muted hover:text-ink hover:bg-hover rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMonth(new Date())}
              className="px-2 py-1 text-xs text-ink-muted hover:text-ink hover:bg-hover rounded"
            >
              Today
            </button>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="p-1 text-ink-muted hover:text-ink hover:bg-hover rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday header */}
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

        {/* Day grid */}
        <div className="grid grid-cols-7 border-l border-edge flex-1 min-h-0 overflow-y-auto auto-rows-fr">
          {cells.map((cell) => (
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
