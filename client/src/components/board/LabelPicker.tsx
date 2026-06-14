import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Label } from '../../types/board';
import { LABEL_COLORS } from '../../types/board';

interface LabelPickerProps {
  labels: Label[];
  selectedIds: string[];
  onToggle: (labelId: string) => void;
  onUpdateLabels: (labels: Label[]) => void;
}

const PALETTE = Object.keys(LABEL_COLORS);

export function LabelPicker({ labels, selectedIds, onToggle, onUpdateLabels }: LabelPickerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function setLabel(id: string, patch: Partial<Label>) {
    onUpdateLabels(labels.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  return (
    <div className="space-y-1.5">
      {labels.map((label) => {
        const selected = selectedIds.includes(label.id);
        const isEditing = editingId === label.id;
        return (
          <div key={label.id} className="flex items-center gap-2">
            <button
              onClick={() => onToggle(label.id)}
              className="flex items-center flex-1 h-8 rounded-md px-2.5 text-sm font-medium text-white"
              style={{ backgroundColor: LABEL_COLORS[label.color] ?? label.color }}
            >
              <span className="flex-1 text-left truncate">{label.name}</span>
              {selected && <Check className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setEditingId(isEditing ? null : label.id)}
              className="text-xs text-ink-muted hover:text-ink px-1"
            >
              {isEditing ? 'Done' : 'Edit'}
            </button>
          </div>
        );
      })}

      {editingId && (
        <div className="mt-2 p-2 bg-muted-bg rounded-lg space-y-2">
          <input
            value={labels.find((l) => l.id === editingId)?.name ?? ''}
            onChange={(e) => setLabel(editingId, { name: e.target.value })}
            placeholder="Label name"
            className="w-full px-2 py-1 text-sm bg-input-bg border border-edge rounded text-ink outline-none focus:border-accent"
          />
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => setLabel(editingId, { color })}
                className="w-7 h-7 rounded-md border-2"
                style={{
                  backgroundColor: LABEL_COLORS[color],
                  borderColor:
                    labels.find((l) => l.id === editingId)?.color === color
                      ? 'var(--color-ink)'
                      : 'transparent',
                }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
