import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  FileText,
  MoreHorizontal,
  Trash2,
  FolderInput,
  ChevronRight,
  ChevronDown,
  Folder,
  Star,
  StarOff,
  Pin,
} from 'lucide-react';
import type { FlatNoteNode } from '../../utils/flattenNotebookTree';
import type { Notebook } from '../../types/notebook';
import { sortNotebooksTree } from '../../utils/sortNotebooksTree';

interface SidebarNoteNodeProps {
  node: FlatNoteNode;
  isSelected: boolean;
  isFocused: boolean;
  contextMenuId: string | null;
  notebooks: Notebook[];
  guideStops: Set<number>;
  onSelect: (notebookId: string, noteId: string) => void;
  onDelete: (noteId: string) => void;
  onContextMenu: (id: string | null) => void;
  onMoveToNotebook: (noteId: string, notebookId: string) => void;
  onToggleFavorite: (id: string, currentState: boolean) => void;
  onClose?: () => void;
}

export function SidebarNoteNode({
  node,
  isSelected,
  isFocused,
  contextMenuId,
  notebooks,
  guideStops,
  onSelect,
  onDelete,
  onContextMenu,
  onMoveToNotebook,
  onToggleFavorite,
  onClose,
}: SidebarNoteNodeProps) {
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const isMenuOpen = contextMenuId === node.id;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: node.id,
    data: { type: 'note', item: node.note, sourceNotebookId: node.notebookId },
  });

  // Valid move targets: all notebooks except the current one
  const moveTargets = notebooks.filter((nb) => nb.id !== node.notebookId);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(isMenuOpen ? null : node.id);
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      id={`treeitem-${node.id}`}
      role="treeitem"
      aria-level={node.depth + 1}
      aria-selected={isSelected}
      onContextMenu={handleContextMenu}
      className={`relative group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors focus:outline-none ${
        isSelected
          ? 'bg-active text-ink'
          : 'text-ink-secondary hover:bg-hover'
      } ${isFocused ? 'outline outline-2 outline-accent outline-offset-[-2px]' : ''} ${isDragging ? 'opacity-50' : ''}`}
      style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
      onClick={() => {
        onSelect(node.notebookId, node.noteId);
        onClose?.();
      }}
    >
      {/* Indent guides */}
      {Array.from({ length: node.depth }, (_, i) => (
        <span
          key={i}
          className={`absolute top-0 border-l border-dashed border-guide ${guideStops.has(i) ? 'bottom-1/2' : 'bottom-0'}`}
          style={{ left: `${i * 16 + 16}px` }}
        />
      ))}

      <span className="w-4.5" />
      <FileText className="w-4 h-4 shrink-0 text-ink-faint" />
      {node.note.isPinned && <Pin className="w-3 h-3 shrink-0 text-amber-400 -rotate-45" />}
      <span className="flex-1 text-sm truncate">{node.note.title}</span>

      <div className="relative">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(isMenuOpen ? null : node.id);
          }}
          className="p-0.5 opacity-0 group-hover:opacity-100 text-ink-faint hover:text-ink-secondary rounded transition-opacity"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-6 z-50 bg-card border border-edge rounded-lg shadow-xl py-1 min-w-[160px]">
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-ink-secondary hover:bg-hover"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(node.noteId, node.note.isFavorite);
                onContextMenu(null);
              }}
            >
              {node.note.isFavorite ? (
                <><StarOff className="w-3.5 h-3.5" /> Remove from Favourites</>
              ) : (
                <><Star className="w-3.5 h-3.5" /> Add to Favourites</>
              )}
            </button>

            {/* Move to notebook */}
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-ink-secondary hover:bg-hover"
              onClick={(e) => {
                e.stopPropagation();
                setShowMoveSubmenu(!showMoveSubmenu);
              }}
            >
              <FolderInput className="w-3.5 h-3.5" /> Move to
              {showMoveSubmenu ? (
                <ChevronDown className="w-3 h-3 ml-auto" />
              ) : (
                <ChevronRight className="w-3 h-3 ml-auto" />
              )}
            </button>

            {showMoveSubmenu && (
              <div className="border-t border-edge-soft mx-2 my-0.5">
                <div className="max-h-48 overflow-y-auto py-0.5">
                  {/* Move to root */}
                  <button
                    className="flex items-center gap-2 w-full pl-5 pr-3 py-1 text-sm text-ink-secondary hover:bg-hover"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToNotebook(node.noteId, '');
                      onContextMenu(null);
                    }}
                  >
                    <Folder className="w-3 h-3" />
                    <span>Root level</span>
                  </button>
                  {sortNotebooksTree(moveTargets).map(({ notebook: target, depth }) => (
                    <button
                      key={target.id}
                      className="flex items-center gap-2 w-full pr-3 py-1 text-sm text-ink-secondary hover:bg-hover"
                      style={{ paddingLeft: `${depth * 12 + 20}px` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveToNotebook(node.noteId, target.id);
                        onContextMenu(null);
                      }}
                    >
                      <Folder className="w-3 h-3" />
                      <span className="truncate">{target.name}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-edge-soft mx-0 my-0.5" />
              </div>
            )}

            <div className="border-t border-edge-soft my-1" />

            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-danger hover:bg-hover"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.noteId);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
