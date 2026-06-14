import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, CheckSquare, FileText, AlignLeft } from 'lucide-react';
import type { Card, Label } from '../../types/board';
import { LABEL_COLORS } from '../../types/board';

interface BoardCardProps {
  card: Card;
  columnId: string;
  labels: Label[];
  onClick: () => void;
}

function formatDue(due: string): string {
  const d = new Date(due);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dueState(due: string, done: boolean): 'done' | 'overdue' | 'soon' | 'normal' {
  if (done) return 'done';
  const now = new Date();
  const d = new Date(due);
  const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'overdue';
  if (diffDays < 2) return 'soon';
  return 'normal';
}

export function BoardCard({ card, columnId, labels, onClick }: BoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card, columnId },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const cardLabels = card.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is Label => Boolean(l));

  const checklistTotal = card.checklist.length;
  const checklistDone = card.checklist.filter((i) => i.done).length;

  const dueBadge = card.dueDate ? dueState(card.dueDate, card.dueDone) : null;
  const dueClasses: Record<string, string> = {
    done: 'bg-success/15 text-success',
    overdue: 'bg-danger/15 text-danger',
    soon: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
    normal: 'bg-muted-bg text-ink-muted',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="group bg-card border border-edge rounded-lg px-3 py-2 shadow-sm hover:border-ink-dim cursor-pointer select-none"
    >
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {cardLabels.map((label) => (
            <span
              key={label.id}
              title={label.name}
              className="h-2 rounded-full"
              style={{ backgroundColor: LABEL_COLORS[label.color] ?? label.color, width: label.name ? 'auto' : '2rem', minWidth: '2rem' }}
            >
              {label.name && (
                <span className="px-1.5 text-[10px] font-medium leading-4 text-white whitespace-nowrap">
                  {label.name}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm text-ink whitespace-pre-wrap break-words">
        {card.title || <span className="text-ink-faint italic">Untitled card</span>}
      </p>

      {(dueBadge || checklistTotal > 0 || card.description || card.note) && (
        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-ink-muted">
          {dueBadge && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${dueClasses[dueBadge]}`}>
              <Calendar className="w-3 h-3" />
              {formatDue(card.dueDate!)}
            </span>
          )}
          {checklistTotal > 0 && (
            <span
              className={`inline-flex items-center gap-1 ${
                checklistDone === checklistTotal ? 'text-success' : ''
              }`}
            >
              <CheckSquare className="w-3 h-3" />
              {checklistDone}/{checklistTotal}
            </span>
          )}
          {card.description && <AlignLeft className="w-3 h-3" />}
          {card.note && (
            <span className="inline-flex items-center gap-1 text-accent" title={`Linked note: ${card.note.title}`}>
              <FileText className="w-3 h-3" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
