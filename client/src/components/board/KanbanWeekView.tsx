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
import { Plus, X, CalendarOff, CheckCircle2 } from 'lucide-react';
import type { Board, Card, Label } from '../../types/board';
import { LABEL_COLORS } from '../../types/board';
import { useBoardCardMutations } from '../../hooks/useBoardCardMutations';
import {
  parseDue,
  startOfWeek,
  weekKey,
  weekLabel,
  weekRangeLabel,
  addDays,
  dayToISO,
  startOfDay,
} from '../../utils/calendar';

interface KanbanWeekViewProps {
  board: Board;
  onOpenCard: (cardId: string) => void;
}

type Bucket =
  | { kind: 'nodate' }
  | { kind: 'done' }
  | { kind: 'week'; monday: Date };

function bucketId(b: Bucket): string {
  if (b.kind === 'nodate') return 'nodate';
  if (b.kind === 'done') return 'done';
  return `week:${weekKey(b.monday)}`;
}

function MiniCard({ card, labels, onClick }: { card: Card; labels: Label[]; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { cardId: card.id },
  });
  const cardLabels = card.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is Label => Boolean(l));
  const due = parseDue(card.dueDate);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="bg-card border border-edge rounded-lg px-3 py-2 shadow-sm hover:border-ink-dim cursor-pointer select-none"
    >
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {cardLabels.map((l) => (
            <span
              key={l.id}
              className="h-2 rounded-full"
              style={{ backgroundColor: LABEL_COLORS[l.color] ?? l.color, minWidth: '2rem' }}
            />
          ))}
        </div>
      )}
      <p className={`text-sm ${card.dueDone ? 'line-through text-ink-faint' : 'text-ink'}`}>
        {card.title || <span className="text-ink-faint italic">Untitled card</span>}
      </p>
      {due && (
        <p className="text-[11px] text-ink-muted mt-1">
          {due.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
      )}
    </div>
  );
}

function WeekColumn({
  bucket,
  title,
  subtitle,
  cards,
  labels,
  accent,
  onOpenCard,
  onAdd,
}: {
  bucket: Bucket;
  title: React.ReactNode;
  subtitle?: string;
  cards: Card[];
  labels: Label[];
  accent?: boolean;
  onOpenCard: (id: string) => void;
  onAdd: (title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucketId(bucket), data: { bucket } });
  const [adding, setAdding] = useState(false);
  const [title2, setTitle2] = useState('');

  function submit() {
    const t = title2.trim();
    if (t) onAdd(t);
    setTitle2('');
    setAdding(false);
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 shrink-0 max-h-full rounded-xl border ${
        isOver ? 'border-accent bg-accent/5' : 'border-edge bg-panel'
      }`}
    >
      <div className="flex items-center gap-1.5 px-3 py-2">
        <h3 className={`flex-1 truncate text-sm font-semibold ${accent ? 'text-success' : 'text-ink'}`}>
          {title}
        </h3>
        <span className="text-xs text-ink-faint">{cards.length}</span>
      </div>
      {subtitle && <div className="px-3 -mt-1.5 mb-1 text-[11px] text-ink-faint">{subtitle}</div>}

      <div className="flex-1 overflow-y-auto px-2 min-h-2">
        <div className="flex flex-col gap-2 pb-2">
          {cards.map((card) => (
            <MiniCard key={card.id} card={card} labels={labels} onClick={() => onOpenCard(card.id)} />
          ))}
        </div>
      </div>

      <div className="p-2 pt-1">
        {adding ? (
          <div>
            <textarea
              autoFocus
              value={title2}
              onChange={(e) => setTitle2(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === 'Escape') {
                  setAdding(false);
                  setTitle2('');
                }
              }}
              placeholder="Enter a title…"
              rows={2}
              className="w-full px-2 py-1.5 text-sm bg-card border border-edge rounded-lg text-ink placeholder:text-placeholder outline-none focus:border-accent resize-none"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={submit}
                className="px-3 py-1 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent-hover"
              >
                Add card
              </button>
              <button onClick={() => { setAdding(false); setTitle2(''); }} className="p-1 text-ink-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 w-full px-2 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-hover rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add a card
          </button>
        )}
      </div>
    </div>
  );
}

export function KanbanWeekView({ board, onOpenCard }: KanbanWeekViewProps) {
  const { setCardDate, setCardDone, addCard } = useBoardCardMutations(board.id);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const allCards = useMemo(() => board.columns.flatMap((c) => c.cards), [board.columns]);
  // Home column for cards created in this view (board's first list).
  const defaultColumnId = board.columns[0]?.id;

  const { weekBuckets, noDateCards, doneCards } = useMemo(() => {
    const done: Card[] = [];
    const noDate: Card[] = [];
    const byWeek = new Map<string, { monday: Date; cards: Card[] }>();

    for (const card of allCards) {
      if (card.dueDone) {
        done.push(card);
        continue;
      }
      const due = parseDue(card.dueDate);
      if (!due) {
        noDate.push(card);
        continue;
      }
      const monday = startOfWeek(due);
      const key = weekKey(monday);
      if (!byWeek.has(key)) byWeek.set(key, { monday, cards: [] });
      byWeek.get(key)!.cards.push(card);
    }

    // Always show the current week + next 3, so there's room for upcoming items.
    const thisMonday = startOfWeek(new Date());
    for (let i = 0; i < 4; i++) {
      const monday = addDays(thisMonday, i * 7);
      const key = weekKey(monday);
      if (!byWeek.has(key)) byWeek.set(key, { monday, cards: [] });
    }

    const buckets = [...byWeek.values()].sort((a, b) => a.monday.getTime() - b.monday.getTime());
    for (const b of buckets) b.cards.sort((a, c) => (parseDue(a.dueDate)!.getTime() - parseDue(c.dueDate)!.getTime()));
    return { weekBuckets: buckets, noDateCards: noDate, doneCards: done };
  }, [allCards]);

  function handleDragStart(e: DragStartEvent) {
    setActiveCardId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveCardId(null);
    const { active, over } = e;
    if (!over) return;
    const cardId = String(active.id);
    const card = allCards.find((c) => c.id === cardId);
    if (!card) return;
    const bucket = over.data.current?.bucket as Bucket | undefined;
    if (!bucket) return;

    if (bucket.kind === 'done') {
      if (!card.dueDone) setCardDone(cardId, true);
      return;
    }
    if (bucket.kind === 'nodate') {
      if (card.dueDone) setCardDone(cardId, false);
      if (card.dueDate) setCardDate(cardId, null);
      return;
    }
    // week bucket — preserve weekday if the card had a date, else Monday
    const prev = parseDue(card.dueDate);
    const weekdayOffset = prev ? (prev.getDay() + 6) % 7 : 0;
    const target = addDays(bucket.monday, weekdayOffset);
    if (card.dueDone) setCardDone(cardId, false);
    setCardDate(cardId, dayToISO(target));
  }

  const activeCard = allCards.find((c) => c.id === activeCardId);

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1 min-h-0 overflow-x-auto p-4">
        <div className="flex items-start gap-3 h-full">
          <WeekColumn
            bucket={{ kind: 'nodate' }}
            title={<span className="flex items-center gap-1.5"><CalendarOff className="w-4 h-4 text-ink-faint" /> No date</span>}
            cards={noDateCards}
            labels={board.labels}
            onOpenCard={onOpenCard}
            onAdd={(t) => defaultColumnId && addCard(defaultColumnId, t, null)}
          />
          {weekBuckets.map((wb) => (
            <WeekColumn
              key={weekKey(wb.monday)}
              bucket={{ kind: 'week', monday: wb.monday }}
              title={weekLabel(wb.monday)}
              subtitle={weekRangeLabel(wb.monday)}
              cards={wb.cards}
              labels={board.labels}
              onOpenCard={onOpenCard}
              onAdd={(t) => defaultColumnId && addCard(defaultColumnId, t, dayToISO(startOfDay(wb.monday)))}
            />
          ))}
          <WeekColumn
            bucket={{ kind: 'done' }}
            title={<span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" /> Done</span>}
            accent
            cards={doneCards}
            labels={board.labels}
            onOpenCard={onOpenCard}
            onAdd={(t) => defaultColumnId && addCard(defaultColumnId, t, null)}
          />
        </div>
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="bg-card border border-edge rounded-lg px-3 py-2 shadow-lg w-64 rotate-2">
            <p className="text-sm text-ink">{activeCard.title || 'Untitled card'}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
