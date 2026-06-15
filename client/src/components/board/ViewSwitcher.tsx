import { Columns3, Calendar, Table, List } from 'lucide-react';
import type { BoardViewType, KanbanGroupBy } from '../../hooks/useBoardViewPrefs';

interface ViewSwitcherProps {
  view: BoardViewType;
  onViewChange: (v: BoardViewType) => void;
  groupBy: KanbanGroupBy;
  onGroupByChange: (g: KanbanGroupBy) => void;
}

const VIEWS: { id: BoardViewType; label: string; Icon: typeof Columns3 }[] = [
  { id: 'kanban', label: 'Kanban', Icon: Columns3 },
  { id: 'calendar', label: 'Calendar', Icon: Calendar },
  { id: 'table', label: 'Table', Icon: Table },
  { id: 'list', label: 'List', Icon: List },
];

export function ViewSwitcher({ view, onViewChange, groupBy, onGroupByChange }: ViewSwitcherProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-0.5 bg-muted-bg rounded-lg p-0.5">
        {VIEWS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md transition-colors ${
              view === id
                ? 'bg-card text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {view === 'kanban' && (
        <div className="flex items-center gap-1 text-sm text-ink-muted">
          <span className="hidden md:inline">Group by:</span>
          <div className="flex items-center gap-0.5 bg-muted-bg rounded-lg p-0.5">
            <button
              onClick={() => onGroupByChange('list')}
              className={`px-2 py-1 rounded-md transition-colors ${
                groupBy === 'list' ? 'bg-card text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              List
            </button>
            <button
              onClick={() => onGroupByChange('week')}
              className={`px-2 py-1 rounded-md transition-colors ${
                groupBy === 'week' ? 'bg-card text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
