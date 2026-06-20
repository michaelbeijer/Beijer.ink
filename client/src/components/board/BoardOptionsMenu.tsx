import { useState, useRef, useEffect } from 'react';
import { Settings } from 'lucide-react';
import type { BoardType } from '../../types/board';

// "Purpose" is the user-facing name for board type — it sets sensible defaults
// (starting view, overdue behaviour) but is intrinsic and rarely changed, so it
// lives here in Options rather than inline beside the frequently-used view tabs.
const PURPOSE_LABELS: Record<BoardType, string> = {
  calendar: 'Calendar',
  todo: 'To-do',
  freeform: 'Free-form',
};

interface BoardOptionsMenuProps {
  type: BoardType;
  onTypeChange: (t: BoardType) => void;
  showOverdue: boolean;
  onShowOverdueChange: (v: boolean) => void;
}

export function BoardOptionsMenu({
  type,
  onTypeChange,
  showOverdue,
  onShowOverdueChange,
}: BoardOptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 text-sm text-ink-muted hover:text-ink hover:bg-hover rounded-md transition-colors"
        title="Board options"
      >
        <Settings className="w-4 h-4" />
        <span className="hidden sm:inline">Options</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-card border border-edge rounded-lg shadow-xl p-3 min-w-[230px] z-50 space-y-3">
          <label className="block">
            <span className="block text-xs text-ink-muted mb-1">Purpose</span>
            <select
              value={type}
              onChange={(e) => onTypeChange(e.target.value as BoardType)}
              className="w-full text-sm bg-input-bg text-ink border border-edge rounded-md px-2 py-1 outline-none focus:border-accent cursor-pointer"
            >
              {(Object.keys(PURPOSE_LABELS) as BoardType[]).map((t) => (
                <option key={t} value={t}>
                  {PURPOSE_LABELS[t]}
                </option>
              ))}
            </select>
            <span className="block text-[11px] text-ink-faint mt-1">
              Sets sensible defaults; you can switch views any time.
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={showOverdue}
              onChange={(e) => onShowOverdueChange(e.target.checked)}
              className="accent-accent"
            />
            Show overdue items
          </label>
        </div>
      )}
    </div>
  );
}
