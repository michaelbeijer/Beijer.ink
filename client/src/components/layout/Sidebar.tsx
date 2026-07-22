import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDroppable } from '@dnd-kit/core';
import { PenLine, FolderPlus, FilePlus, LayoutGrid, CalendarDays, LogOut, Settings, Github, Star, Trash2, ChevronDown } from 'lucide-react';
import { getNotebooks, createNotebook, deleteNotebook, updateNotebook } from '../../api/notebooks';
import { getRootNotes, getFavoriteNotes, createNote, deleteNote, moveNote, updateNote } from '../../api/notes';
import { getBoards, createBoard, deleteBoard, updateBoard } from '../../api/boards';
import type { BoardType } from '../../types/board';
import { useAuth } from '../../contexts/AuthContext';
import { ThemePicker } from './ThemePicker';
import { TextSizePicker } from './TextSizePicker';
import { flattenNotebookTree } from '../../utils/flattenNotebookTree';
import { useNotebookNotes } from '../../hooks/useNotebookNotes';
import { useTreeKeyboardNav } from '../../hooks/useTreeKeyboardNav';
import { SidebarNotebookNode } from './SidebarNotebookNode';
import { SidebarNoteNode } from './SidebarNoteNode';
import { SidebarRootNote } from './SidebarRootNote';
import { SidebarFavoriteItem } from './SidebarFavoriteItem';
import type { Notebook } from '../../types/notebook';

interface SidebarProps {
  selectedNotebookId: string | null;
  selectedNoteId: string | null;
  selectedBoardId?: string | null;
  onSelectNotebook: (id: string) => void;
  onSelectNote: (noteId: string) => void;
  onSelectRootNote: (noteId: string) => void;
  onSelectBoard?: (id: string) => void;
  onBoardDeleted?: (id: string) => void;
  onSelectCalendar?: () => void;
  calendarActive?: boolean;
  autoExpandNotebookId?: string | null;
  onOpenSettings?: () => void;
  onClose?: () => void;
}

export function Sidebar({ selectedNotebookId, selectedNoteId, selectedBoardId, onSelectNotebook, onSelectNote, onSelectRootNote, onSelectBoard, onBoardDeleted, onSelectCalendar, calendarActive, autoExpandNotebookId, onOpenSettings, onClose }: SidebarProps) {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  // Collapsible sidebar sections (Favourites / Folders / Notes / Boards), remembered across reloads.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('beijer-ink-collapsed-sections');
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });
  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem('beijer-ink-collapsed-sections', JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const { data: notebooks = [] } = useQuery({
    queryKey: ['notebooks'],
    queryFn: getNotebooks,
  });

  const createMutation = useMutation({
    mutationFn: createNotebook,
    onSuccess: (nb) => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      if (nb.parentId) {
        setExpandedIds((prev) => new Set([...prev, nb.parentId!]));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotebook,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notebooks'] }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateNotebook(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      setEditingId(null);
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      updateNotebook(id, { parentId }),
    onSuccess: (_, { parentId }) => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      if (parentId) {
        setExpandedIds((prev) => new Set([...prev, parentId]));
      }
    },
  });

  const { data: rootNotes = [] } = useQuery({
    queryKey: ['notes', 'root'],
    queryFn: getRootNotes,
  });

  const createRootNoteMutation = useMutation({
    mutationFn: () => createNote({}),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ['notes', 'root'] });
      onSelectRootNote(note.id);
    },
  });

  const createNoteInNotebookMutation = useMutation({
    mutationFn: (notebookId: string) => createNote({ notebookId }),
    onSuccess: (note, notebookId) => {
      queryClient.invalidateQueries({ queryKey: ['notes', notebookId] });
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      setExpandedIds((prev) => new Set([...prev, notebookId]));
      onSelectNote(note.id);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
    },
  });

  const deleteRootNoteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes', 'root'] }),
  });

  const moveNoteMutation = useMutation({
    mutationFn: ({ noteId, notebookId }: { noteId: string; notebookId: string | null }) =>
      moveNote(noteId, notebookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
    },
  });

  const toggleNotebookFavoriteMutation = useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      updateNotebook(id, { isFavorite }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      queryClient.invalidateQueries({ queryKey: ['notes', 'favorites'] });
    },
  });

  const toggleNoteFavoriteMutation = useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      updateNote(id, { isFavorite }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  // Flag a notebook as the autofingers.com publish source (every note in it goes live).
  const toggleNotebookPublishMutation = useMutation({
    mutationFn: ({ id, publishTarget }: { id: string; publishTarget: boolean }) =>
      updateNotebook(id, { publishTarget }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      queryClient.invalidateQueries({ queryKey: ['note'] }); // open note refetches → PublishPanel toggles
    },
  });

  // Flag a notebook as the beijerterm.com article publish source.
  const toggleNotebookPublishBeijertermMutation = useMutation({
    mutationFn: ({ id, publishBeijerterm }: { id: string; publishBeijerterm: boolean }) =>
      updateNotebook(id, { publishBeijerterm }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      queryClient.invalidateQueries({ queryKey: ['note'] }); // open note refetches → Beijerterm panel toggles
    },
  });

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Auto-expand notebook (e.g. when navigating from search)
  useEffect(() => {
    if (autoExpandNotebookId) {
      setExpandedIds((prev) => {
        if (prev.has(autoExpandNotebookId)) return prev;
        return new Set([...prev, autoExpandNotebookId]);
      });
    }
  }, [autoExpandNotebookId]);

  const { notesMap } = useNotebookNotes(expandedIds);

  const flatNodes = useMemo(
    () => flattenNotebookTree(notebooks, expandedIds, notesMap),
    [notebooks, expandedIds, notesMap]
  );

  // For each node, compute which depth-level guides should stop at the vertical center
  // (because no subsequent node continues that guide line)
  const guideStopsMap = useMemo(() => {
    return flatNodes.map((node, i) => {
      const stops = new Set<number>();
      const nextNode = flatNodes[i + 1];
      for (let d = 0; d < node.depth; d++) {
        if (!nextNode || nextNode.depth <= d) {
          stops.add(d);
        }
      }
      return stops;
    });
  }, [flatNodes]);

  // Determine which ID is currently "selected" in the tree for keyboard nav
  const selectedTreeId = useMemo(() => {
    if (selectedNoteId) {
      // Check if this note is in the flat tree (as a notebook note)
      const noteNode = flatNodes.find((n) => n.type === 'note' && n.noteId === selectedNoteId);
      if (noteNode) return noteNode.id;
    }
    return selectedNotebookId;
  }, [selectedNoteId, selectedNotebookId, flatNodes]);

  const { focusedId, setFocusedId, handleKeyDown, handleFocus, handleBlur } = useTreeKeyboardNav({
    nodes: flatNodes,
    expandedIds,
    toggleExpand,
    onSelect: (node) => {
      if (node.type === 'note') {
        onSelectNote(node.noteId);
        onClose?.();
      } else {
        onSelectNotebook(node.id);
        toggleExpand(node.id);
      }
    },
    selectedId: selectedTreeId,
  });

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenuId) return;
    function handleClick(e: MouseEvent) {
      if (treeRef.current && !treeRef.current.contains(e.target as Node)) {
        setContextMenuId(null);
      }
    }
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [contextMenuId]);

  function handleCreate() {
    createMutation.mutate({ name: 'New Notebook' });
  }

  function handleCreateChild(parentId: string) {
    createMutation.mutate({ name: 'New Notebook', parentId });
  }

  function handleStartRename(nb: Notebook) {
    setEditingId(nb.id);
    setEditName(nb.name);
    setContextMenuId(null);
  }

  function handleRename(id: string) {
    if (editName.trim()) {
      renameMutation.mutate({ id, name: editName.trim() });
    } else {
      setEditingId(null);
    }
  }

  function handleDeleteNotebook(id: string) {
    if (confirm('Delete this notebook and all its notes?')) {
      deleteMutation.mutate(id);
      setContextMenuId(null);
    }
  }

  function handleMove(id: string, parentId: string | null) {
    moveMutation.mutate({ id, parentId });
  }

  function handleCreateRootNote() {
    createRootNoteMutation.mutate();
  }

  function handleCreateNoteInNotebook(notebookId: string) {
    createNoteInNotebookMutation.mutate(notebookId);
  }

  function handleDeleteNote(noteId: string) {
    if (confirm('Delete this note?')) {
      deleteNoteMutation.mutate(noteId);
      setContextMenuId(null);
    }
  }

  function handleDeleteRootNote(id: string) {
    if (confirm('Delete this note?')) {
      deleteRootNoteMutation.mutate(id);
      setContextMenuId(null);
    }
  }

  function handleMoveNoteToNotebook(noteId: string, notebookId: string) {
    // Empty string means "move to root"
    moveNoteMutation.mutate({ noteId, notebookId: notebookId || null });
  }

  function handleToggleNotebookFavorite(id: string, currentState: boolean) {
    toggleNotebookFavoriteMutation.mutate({ id, isFavorite: !currentState });
    setContextMenuId(null);
  }

  function handleToggleNoteFavorite(id: string, currentState: boolean) {
    toggleNoteFavoriteMutation.mutate({ id, isFavorite: !currentState });
    setContextMenuId(null);
  }

  function handleToggleNotebookPublish(id: string, currentState: boolean) {
    toggleNotebookPublishMutation.mutate({ id, publishTarget: !currentState });
    setContextMenuId(null);
  }

  function handleToggleNotebookPublishBeijerterm(id: string, currentState: boolean) {
    toggleNotebookPublishBeijertermMutation.mutate({ id, publishBeijerterm: !currentState });
    setContextMenuId(null);
  }

  const { data: favoriteNotesData = [] } = useQuery({
    queryKey: ['notes', 'favorites'],
    queryFn: getFavoriteNotes,
  });

  const { data: boards = [] } = useQuery({
    queryKey: ['boards'],
    queryFn: getBoards,
  });

  const createBoardMutation = useMutation({
    mutationFn: (type: BoardType) => createBoard({ type }),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      onSelectBoard?.(board.id);
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: deleteBoard,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      onBoardDeleted?.(id);
    },
  });

  const toggleBoardFavoriteMutation = useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      updateBoard(id, { isFavorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['boards'] }),
  });

  function handleDeleteBoard(id: string, name: string) {
    if (confirm(`Delete board "${name}" and all its lists and cards?`)) {
      deleteBoardMutation.mutate(id);
    }
  }

  const favoriteBoards = useMemo(() => boards.filter((b) => b.isFavorite), [boards]);

  const favoriteNotebooks = useMemo(
    () => notebooks.filter((nb) => nb.isFavorite),
    [notebooks]
  );

  const hasFavourites =
    favoriteNotebooks.length > 0 || favoriteNotesData.length > 0 || favoriteBoards.length > 0;

  const { setNodeRef: setRootDropRef, isOver: isOverRootDrop } = useDroppable({
    id: 'root-drop-zone',
    data: { type: 'root-drop' },
  });

  // A collapsible section header: chevron + label, toggles the section's visibility.
  const renderSectionHeader = (key: string, label: string) => {
    const collapsed = collapsedSections.has(key);
    return (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => toggleSection(key)}
        aria-expanded={!collapsed}
        className="flex items-center gap-1 w-full mt-2 pt-2 mb-1 px-2 py-0.5 border-t border-edge-soft rounded-b hover:bg-hover"
      >
        <ChevronDown
          className={`w-3 h-3 shrink-0 text-section-label transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-section-label">
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col bg-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-edge">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity"
        >
          <PenLine className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm text-ink">Beijer.ink</span>
        </button>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleCreateRootNote}
            className="p-1 text-ink-faint hover:text-ink hover:bg-hover rounded transition-colors"
            title="New note"
          >
            <FilePlus className="w-4 h-4" />
          </button>
          <button
            onClick={handleCreate}
            className="p-1 text-ink-faint hover:text-ink hover:bg-hover rounded transition-colors"
            title="New notebook"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => createBoardMutation.mutate('todo')}
            className="p-1 text-ink-faint hover:text-ink hover:bg-hover rounded transition-colors"
            title="New board"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Unified calendar (umbrella over all boards) */}
      {onSelectCalendar && (
        <button
          onClick={() => { onSelectCalendar(); onClose?.(); }}
          className={`relative flex items-center gap-2 mx-1.5 mt-1.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
            calendarActive ? 'sidebar-item-selected bg-active text-ink' : 'text-ink-muted hover:bg-hover hover:text-ink'
          }`}
        >
          <CalendarDays className="w-4 h-4 text-accent shrink-0" />
          <span className="flex-1 text-left">Calendar</span>
          <span className="text-[10px] text-ink-faint">every board</span>
        </button>
      )}

      {/* Notebook tree */}
      <div
        ref={treeRef}
        className="flex-1 overflow-y-auto px-1.5 py-1.5"
        role="tree"
        aria-label="Notebooks"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {/* Favourites section */}
        {hasFavourites && (
          <>
            {renderSectionHeader('favourites', 'Favourites')}
            {!collapsedSections.has('favourites') && (
            <div className="pl-2" role="group">
            {favoriteNotebooks.map((nb) => (
              <SidebarFavoriteItem
                key={`fav-nb-${nb.id}`}
                id={nb.id}
                type="notebook"
                name={nb.name}
                isSelected={nb.id === selectedNotebookId && selectedNoteId === null}
                contextMenuId={contextMenuId}
                onSelect={() => { onSelectNotebook(nb.id); toggleExpand(nb.id); onClose?.(); }}
                onRemoveFavorite={() => handleToggleNotebookFavorite(nb.id, true)}
                onContextMenu={setContextMenuId}
              />
            ))}
            {favoriteNotesData.map((note) => (
              <SidebarFavoriteItem
                key={`fav-note-${note.id}`}
                id={note.id}
                type="note"
                name={note.title}
                isSelected={note.id === selectedNoteId}
                contextMenuId={contextMenuId}
                onSelect={() => {
                  if (note.notebookId) {
                    onSelectNote(note.id);
                  } else {
                    onSelectRootNote(note.id);
                  }
                  onClose?.();
                }}
                onRemoveFavorite={() => handleToggleNoteFavorite(note.id, true)}
                onContextMenu={setContextMenuId}
              />
            ))}
            {favoriteBoards.map((board) => (
              <div
                key={`fav-board-${board.id}`}
                onClick={() => { onSelectBoard?.(board.id); onClose?.(); }}
                className={`relative group flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer ${
                  board.id === selectedBoardId ? 'sidebar-item-selected bg-active' : 'hover:bg-hover'
                }`}
              >
                <LayoutGrid className="w-4 h-4 text-ink-faint shrink-0" />
                <span className="flex-1 truncate text-sm text-ink">{board.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBoardFavoriteMutation.mutate({ id: board.id, isFavorite: false });
                  }}
                  className="text-fav-text"
                  title="Remove from favourites"
                >
                  <Star className="w-3.5 h-3.5" fill="currentColor" />
                </button>
              </div>
            ))}
            </div>
            )}
          </>
        )}

        {flatNodes.length > 0 && renderSectionHeader('folders', 'Folders')}

        {!collapsedSections.has('folders') && <div className="pl-2" role="group">{flatNodes.map((node, i) => {
          if (node.type === 'note') {
            return (
              <SidebarNoteNode
                key={node.id}
                node={node}
                isSelected={node.noteId === selectedNoteId}
                isFocused={node.id === focusedId}
                contextMenuId={contextMenuId}
                notebooks={notebooks}
                guideStops={guideStopsMap[i]}
                onSelect={(nbId, noteId) => {
                  onSelectNote(noteId);
                  setFocusedId(node.id);
                  onClose?.();
                }}
                onDelete={handleDeleteNote}
                onContextMenu={setContextMenuId}
                onMoveToNotebook={handleMoveNoteToNotebook}
                onToggleFavorite={handleToggleNoteFavorite}
                onClose={onClose}
              />
            );
          }
          return (
            <SidebarNotebookNode
              key={node.id}
              node={node}
              isSelected={node.id === selectedNotebookId && selectedNoteId === null}
              isFocused={node.id === focusedId}
              isDropTarget={false}
              editingId={editingId}
              editName={editName}
              contextMenuId={contextMenuId}
              notebooks={notebooks}
              guideStops={guideStopsMap[i]}
              onSelect={(id: string) => { onSelectNotebook(id); toggleExpand(id); setFocusedId(id); }}
              onToggleExpand={toggleExpand}
              onStartRename={handleStartRename}
              onRename={handleRename}
              onCancelRename={() => setEditingId(null)}
              onDelete={handleDeleteNotebook}
              onContextMenu={setContextMenuId}
              onEditNameChange={setEditName}
              onMove={handleMove}
              onCreateChild={handleCreateChild}
              onCreateNote={handleCreateNoteInNotebook}
              onToggleFavorite={handleToggleNotebookFavorite}
              onTogglePublish={handleToggleNotebookPublish}
              onTogglePublishBeijerterm={handleToggleNotebookPublishBeijerterm}
              onClose={onClose}
            />
          );
        })}</div>}

        {notebooks.length === 0 && rootNotes.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-8">
            No notebooks yet.
            <br />
            <button onClick={handleCreate} className="text-accent hover:underline mt-1 inline-block">
              Create one
            </button>
          </p>
        )}

        {/* Root drop zone - visible when dragging */}
        <div
          ref={setRootDropRef}
          className={`mx-1.5 my-1 rounded-md border border-dashed transition-colors ${
            isOverRootDrop
              ? 'border-accent bg-accent/10 py-2'
              : 'border-transparent py-0'
          }`}
        >
          {isOverRootDrop && (
            <span className="block text-center text-xs text-accent">
              Drop here for root level
            </span>
          )}
        </div>

        {/* Root notes */}
        {rootNotes.length > 0 && (
          <>
            {renderSectionHeader('notes', 'Notes')}
            {!collapsedSections.has('notes') && <div className="pl-2" role="group">{rootNotes.map((note) => (
              <SidebarRootNote
                key={note.id}
                note={note}
                isSelected={note.id === selectedNoteId && selectedNotebookId === null}
                contextMenuId={contextMenuId}
                notebooks={notebooks}
                onSelect={(id) => { onSelectRootNote(id); onClose?.(); }}
                onDelete={handleDeleteRootNote}
                onContextMenu={setContextMenuId}
                onMoveToNotebook={handleMoveNoteToNotebook}
                onToggleFavorite={handleToggleNoteFavorite}
              />
            ))}</div>}
          </>
        )}

        {/* Boards */}
        {boards.length > 0 && (
          <>
            {renderSectionHeader('boards', 'Boards')}
            {!collapsedSections.has('boards') && <div className="pl-2" role="group">{boards.map((board) => (
              <div
                key={`board-${board.id}`}
                onClick={() => { onSelectBoard?.(board.id); onClose?.(); }}
                className={`relative group flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer ${
                  board.id === selectedBoardId ? 'sidebar-item-selected bg-active' : 'hover:bg-hover'
                }`}
              >
                <LayoutGrid className="w-4 h-4 text-ink-faint shrink-0" />
                <span className="flex-1 truncate text-sm text-ink">{board.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBoardFavoriteMutation.mutate({ id: board.id, isFavorite: !board.isFavorite });
                  }}
                  className={`${
                    board.isFavorite ? 'text-fav-text' : 'text-ink-faint opacity-0 group-hover:opacity-100'
                  } transition-opacity`}
                  title={board.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                >
                  <Star className="w-3.5 h-3.5" fill={board.isFavorite ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBoard(board.id, board.name);
                  }}
                  className="text-ink-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete board"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}</div>}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-edge p-1.5">
        <ThemePicker />
        <TextSizePicker />
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-hover rounded-md transition-colors"
        >
          <Settings className="w-4 h-4" /> Settings
        </button>
        <a
          href="https://github.com/michaelbeijer/beijer.ink"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-hover rounded-md transition-colors"
        >
          <Github className="w-4 h-4" /> GitHub
        </a>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-hover rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
