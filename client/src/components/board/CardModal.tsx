import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Trash2,
  Calendar,
  Tag,
  AlignLeft,
  CheckSquare,
  FileText,
  Plus,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';
import type { Board, Card, ChecklistItem, Label } from '../../types/board';
import { LABEL_COLORS } from '../../types/board';
import { updateCard, deleteCard, updateBoard } from '../../api/boards';
import { createNote } from '../../api/notes';
import { searchNotes } from '../../api/search';
import type { SearchResult } from '../../types/search';
import { LabelPicker } from './LabelPicker';

interface CardModalProps {
  board: Board;
  card: Card;
  onClose: () => void;
  onOpenNote: (noteId: string) => void;
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

function newId(): string {
  return crypto.randomUUID();
}

export function CardModal({ board, card, onClose, onOpenNote }: CardModalProps) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['board', board.id] });

  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [showLabels, setShowLabels] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState<SearchResult[]>([]);
  const searchRef = useRef<number | null>(null);

  // Re-sync local fields if the card object changes underneath us.
  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description);
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchMutation = useMutation({
    mutationFn: (body: Parameters<typeof updateCard>[1]) => updateCard(card.id, body),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCard(card.id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const labelsMutation = useMutation({
    mutationFn: (labels: Label[]) => updateBoard(board.id, { labels }),
    onSuccess: invalidate,
  });

  const createNoteMutation = useMutation({
    mutationFn: async () => {
      const note = await createNote({ content: `<h1>${title || 'Untitled card'}</h1>` });
      return updateCard(card.id, { noteId: note.id });
    },
    onSuccess: invalidate,
  });

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Debounced note search for the "link existing note" picker
  useEffect(() => {
    if (!showLinkSearch) return;
    if (searchRef.current) window.clearTimeout(searchRef.current);
    if (!linkQuery.trim()) {
      setLinkResults([]);
      return;
    }
    searchRef.current = window.setTimeout(async () => {
      try {
        const res = await searchNotes({ q: linkQuery.trim(), limit: 8 });
        setLinkResults(res.results);
      } catch {
        setLinkResults([]);
      }
    }, 250);
  }, [linkQuery, showLinkSearch]);

  function saveTitle() {
    const trimmed = title.trim();
    if (trimmed !== card.title) patchMutation.mutate({ title: trimmed });
  }

  function saveDescription() {
    if (description !== card.description) patchMutation.mutate({ description });
  }

  function toggleLabel(labelId: string) {
    const next = card.labelIds.includes(labelId)
      ? card.labelIds.filter((id) => id !== labelId)
      : [...card.labelIds, labelId];
    patchMutation.mutate({ labelIds: next });
  }

  function setChecklist(next: ChecklistItem[]) {
    patchMutation.mutate({ checklist: next });
  }

  function addChecklistItem() {
    const text = newChecklistText.trim();
    if (!text) return;
    setChecklist([...card.checklist, { id: newId(), text, done: false }]);
    setNewChecklistText('');
  }

  const checklistDone = card.checklist.filter((i) => i.done).length;
  const checklistTotal = card.checklist.length;
  const cardLabels = card.labelIds
    .map((id) => board.labels.find((l) => l.id === id))
    .filter((l): l is Label => Boolean(l));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface rounded-xl shadow-2xl border border-edge w-full max-w-2xl mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-2 px-5 py-4 border-b border-edge">
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            rows={1}
            className="flex-1 resize-none text-lg font-semibold bg-transparent text-ink outline-none"
            placeholder="Card title"
          />
          <button onClick={onClose} className="p-1 text-ink-faint hover:text-ink rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Labels */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <Tag className="w-3.5 h-3.5" /> Labels
              </h4>
              <button
                onClick={() => setShowLabels((s) => !s)}
                className="text-xs text-accent hover:underline"
              >
                {showLabels ? 'Done' : 'Edit'}
              </button>
            </div>
            {cardLabels.length > 0 && !showLabels && (
              <div className="flex flex-wrap gap-1.5">
                {cardLabels.map((l) => (
                  <span
                    key={l.id}
                    className="px-2 h-6 inline-flex items-center rounded text-xs font-medium text-white"
                    style={{ backgroundColor: LABEL_COLORS[l.color] ?? l.color }}
                  >
                    {l.name || ' '}
                  </span>
                ))}
              </div>
            )}
            {showLabels && (
              <LabelPicker
                labels={board.labels}
                selectedIds={card.labelIds}
                onToggle={toggleLabel}
                onUpdateLabels={(labels) => labelsMutation.mutate(labels)}
              />
            )}
            {cardLabels.length === 0 && !showLabels && (
              <p className="text-sm text-ink-faint">No labels.</p>
            )}
          </section>

          {/* Due date */}
          <section>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
              <Calendar className="w-3.5 h-3.5" /> Due date
            </h4>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={toDateInput(card.dueDate)}
                onChange={(e) =>
                  patchMutation.mutate({
                    dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
                className="px-2 py-1 text-sm bg-input-bg border border-edge rounded text-ink outline-none focus:border-accent"
              />
              {card.dueDate && (
                <>
                  {/* On boards linked to Google Tasks, "done" is driven by the
                      card's column (the last list), not this checkbox — so we
                      hide it to keep a single source of truth. */}
                  {!board.settings?.googleTaskListId && (
                    <label className="flex items-center gap-1.5 text-sm text-ink-muted">
                      <input
                        type="checkbox"
                        checked={card.dueDone}
                        onChange={(e) => patchMutation.mutate({ dueDone: e.target.checked })}
                      />
                      Complete
                    </label>
                  )}
                  <button
                    onClick={() => patchMutation.mutate({ dueDate: null, dueDone: false })}
                    className="text-xs text-ink-muted hover:text-danger"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
            {board.settings?.googleTaskListId && (
              <p className="mt-2 text-[11px] text-ink-faint">
                Synced with Google Tasks — move this card to the last list to mark it done.
              </p>
            )}
          </section>

          {/* Description */}
          <section>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
              <AlignLeft className="w-3.5 h-3.5" /> Description
            </h4>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              rows={4}
              placeholder="Add a more detailed description…"
              className="w-full px-3 py-2 text-sm bg-input-bg border border-edge rounded-lg text-ink placeholder:text-placeholder outline-none focus:border-accent resize-y"
            />
          </section>

          {/* Checklist */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <CheckSquare className="w-3.5 h-3.5" /> Checklist
              </h4>
              {checklistTotal > 0 && (
                <span className="text-xs text-ink-muted">
                  {checklistDone}/{checklistTotal}
                </span>
              )}
            </div>
            {checklistTotal > 0 && (
              <div className="h-1.5 bg-muted-bg rounded-full mb-2 overflow-hidden">
                <div
                  className="h-full bg-success transition-all"
                  style={{ width: `${(checklistDone / checklistTotal) * 100}%` }}
                />
              </div>
            )}
            <div className="space-y-1">
              {card.checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() =>
                      setChecklist(
                        card.checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i))
                      )
                    }
                  />
                  <span
                    className={`flex-1 text-sm ${
                      item.done ? 'line-through text-ink-faint' : 'text-ink'
                    }`}
                  >
                    {item.text}
                  </span>
                  <button
                    onClick={() => setChecklist(card.checklist.filter((i) => i.id !== item.id))}
                    className="p-0.5 text-ink-faint hover:text-danger opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addChecklistItem();
                }}
                placeholder="Add an item…"
                className="flex-1 px-2 py-1 text-sm bg-input-bg border border-edge rounded text-ink placeholder:text-placeholder outline-none focus:border-accent"
              />
              <button
                onClick={addChecklistItem}
                className="px-2.5 py-1 text-sm bg-muted-bg text-ink rounded hover:bg-hover"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Linked note */}
          <section>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
              <FileText className="w-3.5 h-3.5" /> Linked note
            </h4>
            {card.note ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenNote(card.note!.id)}
                  className="flex items-center gap-2 flex-1 px-3 py-2 text-sm bg-muted-bg rounded-lg text-accent hover:bg-hover"
                >
                  <FileText className="w-4 h-4" />
                  <span className="truncate">{card.note.title || 'Untitled'}</span>
                </button>
                <button
                  onClick={() => patchMutation.mutate({ noteId: null })}
                  className="flex items-center gap-1 px-2 py-2 text-sm text-ink-muted hover:text-danger"
                  title="Unlink note"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => createNoteMutation.mutate()}
                    disabled={createNoteMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted-bg text-ink rounded-lg hover:bg-hover"
                  >
                    <Plus className="w-4 h-4" /> Create note from card
                  </button>
                  <button
                    onClick={() => setShowLinkSearch((s) => !s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted-bg text-ink rounded-lg hover:bg-hover"
                  >
                    <LinkIcon className="w-4 h-4" /> Link existing note
                  </button>
                </div>
                {showLinkSearch && (
                  <div>
                    <input
                      autoFocus
                      value={linkQuery}
                      onChange={(e) => setLinkQuery(e.target.value)}
                      placeholder="Search notes to link…"
                      className="w-full px-2 py-1.5 text-sm bg-input-bg border border-edge rounded text-ink placeholder:text-placeholder outline-none focus:border-accent"
                    />
                    {linkResults.length > 0 && (
                      <div className="mt-1 border border-edge rounded-lg divide-y divide-edge overflow-hidden">
                        {linkResults.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              patchMutation.mutate({ noteId: r.id });
                              setShowLinkSearch(false);
                              setLinkQuery('');
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-ink hover:bg-hover"
                          >
                            {r.title || 'Untitled'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-edge flex justify-end">
          <button
            onClick={() => {
              if (confirm('Delete this card?')) deleteMutation.mutate();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-danger hover:bg-danger/10 rounded-lg"
          >
            <Trash2 className="w-4 h-4" /> Delete card
          </button>
        </div>
      </div>
    </div>
  );
}
