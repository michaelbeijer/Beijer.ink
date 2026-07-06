import { useState, useCallback } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Trash2,
  Edit3,
  FolderInput,
  FolderPlus,
  FilePlus,
  Star,
  StarOff,
  UploadCloud,
  CloudOff,
} from 'lucide-react';
import type { FlatNotebookNode } from '../../utils/flattenNotebookTree';
import type { Notebook } from '../../types/notebook';
import { isDescendant } from '../../utils/isDescendant';
import { sortNotebooksTree } from '../../utils/sortNotebooksTree';

interface SidebarNotebookNodeProps {
  node: FlatNotebookNode;
  isSelected: boolean;
  isFocused: boolean;
  isDropTarget: boolean;
  editingId: string | null;
  editName: string;
  contextMenuId: string | null;
  notebooks: Notebook[];
  guideStops: Set<number>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onStartRename: (nb: Notebook) => void;
  onRename: (id: string) => void;
  onCancelRename: () => void;
  onDelete: (id: string) => void;
  onContextMenu: (id: string | null) => void;
  onEditNameChange: (name: string) => void;
  onMove: (id: string, parentId: string | null) => void;
  onCreateChild: (parentId: string) => void;
  onCreateNote: (notebookId: string) => void;
  onToggleFavorite: (id: string, currentState: boolean) => void;
  onTogglePublish: (id: string, currentState: boolean) => void;
  onClose?: () => void;
}

export function SidebarNotebookNode({
  node,
  isSelected,
  isFocused,
  isDropTarget,
  editingId,
  editName,
  contextMenuId,
  notebooks,
  guideStops,
  onSelect,
  onToggleExpand,
  onStartRename,
  onRename,
  onCancelRename,
  onDelete,
  onContextMenu,
  onEditNameChange,
  onMove,
  onCreateChild,
  onCreateNote,
  onToggleFavorite,
  onTogglePublish,
  onClose,
}: SidebarNotebookNodeProps) {
  const nb = node.notebook;
  const isEditing = editingId === nb.id;
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: nb.id,
    data: { type: 'notebook', item: nb },
  });

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: nb.id,
    data: { type: 'notebook', item: nb },
  });

  const mergedRef = useCallback((el: HTMLDivElement | null) => {
    setDropRef(el);
    setDragRef(el);
  }, [setDropRef, setDragRef]);

  const showDropHighlight = isDropTarget || isOver;

  // Valid move targets: not self, not descendants of self
  const moveTargets = notebooks.filter(
    (target) =>
      target.id !== nb.id && !isDescendant(notebooks, nb.id, target.id)
  );

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(contextMenuId === nb.id ? null : nb.id);
  }

  return (
    <div
      ref={mergedRef}
      {...attributes}
      {...listeners}
      id={`treeitem-${nb.id}`}
      role="treeitem"
      aria-level={node.depth + 1}
      aria-expanded={node.hasChildren ? node.isExpanded : undefined}
      aria-selected={isSelected}
      onContextMenu={handleContextMenu}
      className={`relative group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors focus:outline-none ${
        showDropHighlight
          ? 'ring-2 ring-accent ring-inset bg-accent/10'
          : isSelected
            ? 'bg-active text-ink'
            : 'text-ink hover:bg-hover'
      } ${isFocused ? 'outline outline-2 outline-accent outline-offset-[-2px]' : ''} ${isDragging ? 'opacity-50' : ''}`}
      style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
      onClick={() => {
        onSelect(nb.id);
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

      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand(nb.id);
        }}
        className="p-0.5 rounded text-ink-faint hover:text-ink-secondary"
      >
        {node.isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>

      {node.hasChildren && node.isExpanded ? (
        <FolderOpen className="w-4 h-4 shrink-0 text-ink-faint" />
      ) : (
        <Folder className="w-4 h-4 shrink-0 text-ink-faint" />
      )}

      {isEditing ? (
        <input
          className="flex-1 bg-muted-bg text-ink text-sm px-1 py-0.5 rounded outline-none"
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          onBlur={() => onRename(nb.id)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') onRename(nb.id);
            if (e.key === 'Escape') onCancelRename();
          }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 text-sm font-medium truncate">{nb.name}</span>
      )}

      {nb.publishTarget && (
        <UploadCloud
          className="w-3 h-3 shrink-0 text-accent"
          aria-label="Published to autofingers.com"
        />
      )}

      <span className="text-[10px] text-ink-dim tabular-nums">
        {nb._count.notes || ''}
      </span>

      <div className="relative">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(contextMenuId === nb.id ? null : nb.id);
          }}
          className="p-0.5 opacity-0 group-hover:opacity-100 text-ink-faint hover:text-ink-secondary rounded transition-opacity"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {contextMenuId === nb.id && (
          <div className="absolute right-0 top-6 z-50 bg-card border border-edge rounded-lg shadow-xl py-1 min-w-[160px]">
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-ink-secondary hover:bg-hover"
              onClick={(e) => {
                e.stopPropagation();
                onStartRename(nb);
              }}
            >
              <Edit3 className="w-3.5 h-3.5" /> Rename
            </button>

            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-ink-secondary hover:bg-hover"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(nb.id, nb.isFavorite);
              }}
            >
              {nb.isFavorite ? (
                <><StarOff className="w-3.5 h-3.5" /> Remove from Favourites</>
              ) : (
                <><Star className="w-3.5 h-3.5" /> Add to Favourites</>
              )}
            </button>

            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-ink-secondary hover:bg-hover"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePublish(nb.id, !!nb.publishTarget);
              }}
            >
              {nb.publishTarget ? (
                <><CloudOff className="w-3.5 h-3.5" /> Stop publishing to autofingers</>
              ) : (
                <><UploadCloud className="w-3.5 h-3.5" /> Publish to autofingers</>
              )}
            </button>

            {/* Move to (inline expandable) */}
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
              <div className="border-t border-edge-soft mx-2 my-0.5" >
                <div className="max-h-48 overflow-y-auto py-0.5">
                  {/* Root level option */}
                  <button
                    className={`flex items-center gap-2 w-full pl-5 pr-3 py-1 text-sm hover:bg-hover ${
                      nb.parentId === null
                        ? 'text-ink-faint'
                        : 'text-ink-secondary'
                    }`}
                    disabled={nb.parentId === null}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(nb.id, null);
                      onContextMenu(null);
                    }}
                  >
                    <Folder className="w-3 h-3" />
                    <span>Root level</span>
                    {nb.parentId === null && <span className="text-[10px] text-ink-faint ml-auto">(current)</span>}
                  </button>

                  {sortNotebooksTree(moveTargets).map(({ notebook: target, depth }) => (
                    <button
                      key={target.id}
                      className={`flex items-center gap-2 w-full pr-3 py-1 text-sm hover:bg-hover ${
                        nb.parentId === target.id
                          ? 'text-ink-faint'
                          : 'text-ink-secondary'
                      }`}
                      style={{ paddingLeft: `${depth * 12 + 20}px` }}
                      disabled={nb.parentId === target.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(nb.id, target.id);
                        onContextMenu(null);
                      }}
                    >
                      <Folder className="w-3 h-3" />
                      <span className="truncate">{target.name}</span>
                      {nb.parentId === target.id && <span className="text-[10px] text-ink-faint ml-auto">(current)</span>}
                    </button>
                  ))}
                </div>
                <div className="border-t border-edge-soft mx-0 my-0.5" />
              </div>
            )}

            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-ink-secondary hover:bg-hover"
              onClick={(e) => {
                e.stopPropagation();
                onCreateNote(nb.id);
                onContextMenu(null);
              }}
            >
              <FilePlus className="w-3.5 h-3.5" /> New note
            </button>

            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-ink-secondary hover:bg-hover"
              onClick={(e) => {
                e.stopPropagation();
                onCreateChild(nb.id);
                onContextMenu(null);
              }}
            >
              <FolderPlus className="w-3.5 h-3.5" /> New sub-notebook
            </button>

            <div className="border-t border-edge-soft my-1" />

            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-danger hover:bg-hover"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(nb.id);
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
