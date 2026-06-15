import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import type { Board, Card, Label } from '../../types/board';
import { LABEL_COLORS } from '../../types/board';
import { useBoardCardMutations } from '../../hooks/useBoardCardMutations';
import { parseDue, dayToISO } from '../../utils/calendar';

interface TableViewProps {
  board: Board;
  onOpenCard: (cardId: string) => void;
}

function dateInputValue(iso: string | null): string {
  const d = parseDue(iso);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TableView({ board, onOpenCard }: TableViewProps) {
  const { setCardTitle, setCardDate, setCardDone } = useBoardCardMutations(board.id);

  const columnName = useMemo(() => {
    const m = new Map(board.columns.map((c) => [c.id, c.name]));
    return (id: string) => m.get(id) ?? '';
  }, [board.columns]);

  const cards = useMemo(() => {
    const all = board.columns.flatMap((c) => c.cards);
    return all.sort((a, b) => {
      const da = parseDue(a.dueDate)?.getTime() ?? Infinity;
      const db = parseDue(b.dueDate)?.getTime() ?? Infinity;
      return da - db;
    });
  }, [board.columns]);

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-panel">
          <tr className="text-left text-xs uppercase tracking-wider text-ink-muted">
            <th className="px-2 py-2 font-medium w-8"></th>
            <th className="px-2 py-2 font-medium">Title</th>
            <th className="px-2 py-2 font-medium w-36">Date</th>
            <th className="px-2 py-2 font-medium">Labels</th>
            <th className="px-2 py-2 font-medium w-20">Checklist</th>
            <th className="px-2 py-2 font-medium w-40">List</th>
            <th className="px-2 py-2 font-medium w-12"></th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card: Card) => {
            const cardLabels = card.labelIds
              .map((id) => board.labels.find((l) => l.id === id))
              .filter((l): l is Label => Boolean(l));
            const done = card.checklist.filter((i) => i.done).length;
            return (
              <tr key={card.id} className="border-b border-edge hover:bg-hover">
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={card.dueDone}
                    onChange={(e) => setCardDone(card.id, e.target.checked)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    key={card.title}
                    defaultValue={card.title}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== card.title) setCardTitle(card.id, v);
                    }}
                    placeholder="Untitled card"
                    className={`w-full bg-transparent outline-none text-ink ${
                      card.dueDone ? 'line-through text-ink-faint' : ''
                    }`}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="date"
                    value={dateInputValue(card.dueDate)}
                    onChange={(e) =>
                      setCardDate(card.id, e.target.value ? dayToISO(new Date(e.target.value)) : null)
                    }
                    className="bg-input-bg border border-edge rounded px-1.5 py-0.5 text-xs text-ink outline-none focus:border-accent"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {cardLabels.map((l) => (
                      <span
                        key={l.id}
                        title={l.name}
                        className="px-1.5 h-4 inline-flex items-center rounded text-[10px] text-white"
                        style={{ backgroundColor: LABEL_COLORS[l.color] ?? l.color }}
                      >
                        {l.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-1.5 text-ink-muted text-xs">
                  {card.checklist.length > 0 ? `${done}/${card.checklist.length}` : ''}
                </td>
                <td className="px-2 py-1.5 text-ink-muted text-xs truncate">{columnName(card.columnId)}</td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    onClick={() => onOpenCard(card.id)}
                    className="text-ink-faint hover:text-accent"
                    title="Open card"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
          {cards.length === 0 && (
            <tr>
              <td colSpan={7} className="px-2 py-8 text-center text-ink-muted">
                No cards yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
