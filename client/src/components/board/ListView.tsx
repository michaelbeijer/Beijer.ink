import { useMemo } from 'react';
import type { Board, Card, Label } from '../../types/board';
import { LABEL_COLORS } from '../../types/board';
import { useBoardCardMutations } from '../../hooks/useBoardCardMutations';
import { parseDue, startOfDay, startOfWeek, endOfWeek } from '../../utils/calendar';

interface ListViewProps {
  board: Board;
  onOpenCard: (cardId: string) => void;
}

type Group = 'Overdue' | 'Today' | 'This week' | 'Later' | 'No date';
const GROUP_ORDER: Group[] = ['Overdue', 'Today', 'This week', 'Later', 'No date'];

function groupFor(card: Card): Group {
  const due = parseDue(card.dueDate);
  if (!due) return 'No date';
  const today = startOfDay(new Date());
  if (due.getTime() < today.getTime()) return 'Overdue';
  if (due.getTime() === today.getTime()) return 'Today';
  if (due.getTime() <= endOfWeek(today).getTime() && due.getTime() >= startOfWeek(today).getTime())
    return 'This week';
  return 'Later';
}

export function ListView({ board, onOpenCard }: ListViewProps) {
  const { setCardDone } = useBoardCardMutations(board.id);

  const groups = useMemo(() => {
    const all = board.columns.flatMap((c) => c.cards);
    const map = new Map<Group, Card[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const card of all) map.get(groupFor(card))!.push(card);
    for (const list of map.values())
      list.sort((a, b) => {
        const da = parseDue(a.dueDate)?.getTime() ?? Infinity;
        const db = parseDue(b.dueDate)?.getTime() ?? Infinity;
        return da - db;
      });
    return map;
  }, [board.columns]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto space-y-5">
        {GROUP_ORDER.map((g) => {
          const cards = groups.get(g)!;
          if (cards.length === 0) return null;
          return (
            <section key={g}>
              <h3
                className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  g === 'Overdue' ? 'text-danger' : 'text-ink-muted'
                }`}
              >
                {g} <span className="text-ink-faint">({cards.length})</span>
              </h3>
              <div className="divide-y divide-edge border border-edge rounded-lg overflow-hidden">
                {cards.map((card) => {
                  const cardLabels = card.labelIds
                    .map((id) => board.labels.find((l) => l.id === id))
                    .filter((l): l is Label => Boolean(l));
                  const due = parseDue(card.dueDate);
                  return (
                    <div
                      key={card.id}
                      onClick={() => onOpenCard(card.id)}
                      className="flex items-center gap-3 px-3 py-2 bg-card hover:bg-hover cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={card.dueDone}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setCardDone(card.id, e.target.checked)}
                      />
                      <span
                        className={`flex-1 text-sm truncate ${
                          card.dueDone ? 'line-through text-ink-faint' : 'text-ink'
                        }`}
                      >
                        {card.title || 'Untitled card'}
                      </span>
                      <div className="flex items-center gap-1">
                        {cardLabels.map((l) => (
                          <span
                            key={l.id}
                            className="w-2 h-2 rounded-full"
                            title={l.name}
                            style={{ backgroundColor: LABEL_COLORS[l.color] ?? l.color }}
                          />
                        ))}
                      </div>
                      {due && (
                        <span className="text-xs text-ink-muted w-24 text-right">
                          {due.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
