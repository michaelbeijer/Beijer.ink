import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
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
  onClose,
}: SidebarNotebookNodeProps) {
  const nb = node.notebook;
  const isEditing = editingId === nb.id;
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: nb.id,
    data: { type: 'notebook', item: nb },
  });

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
      ref={setNodeRef}
      id={`treeitem-${nb.id}`}
      role="treeitem"
      aria-level={node.depth + 1}
      aria-expanded={node.hasChildren ? node.isExpanded : undefined}
      aria-selected={isSelected}
      onContextMenu={handleContextMenu}
      className={`relative group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors focus:outline-none ${
        showDropHighlight
          ? 'ring-2 ring-blue-500 ring-inset bg-blue-600/10'
          : isSelected
            ? 'bg-slate-200/70 dark:bg-slate-800/70 text-slate-900 dark:text-white'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
      } ${isFocused ? 'outline outline-2 outline-blue-500 outline-offset-[-2px]' : ''}`}
      style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
      onClick={() => {
        onSelect(nb.id);
      }}
    >
      {/* Indent guides */}
      {Array.from({ length: node.depth }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 bottom-0 border-l border-dashed border-blue-400/50 dark:border-blue-500/40"
          style={{ left: `${i * 16 + 16}px` }}
        />
      ))}

      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand(nb.id);
        }}
        className="p-0.5 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
      >
        {node.isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>

      {node.hasChildren && node.isExpanded ? (
        <FolderOpen className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
      ) : (
        <Folder className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
      )}

      {isEditing ? (
        <input
          className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white text-sm px-1 py-0.5 rounded outline-none"
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
        <span className="flex-1 text-sm truncate">{nb.name}</span>
      )}

      <span className="text-[10px] text-slate-400 dark:text-slate-600 tabular-nums">
        {nb._count.notes || ''}
      </span>

      <div className="relative">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(contextMenuId === nb.id ? null : nb.id);
          }}
          className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-opacity"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {contextMenuId === nb.id && (
          <div className="absolute right-0 top-6 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]">
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                onStartRename(nb);
              }}
            >
              <Edit3 className="w-3.5 h-3.5" /> Rename
            </button>

            {/* Move to (inline expandable) */}
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
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
              <div className="border-t border-slate-100 dark:border-slate-700 mx-2 my-0.5" >
                <div className="max-h-48 overflow-y-auto py-0.5">
                  {/* Root level option */}
                  <button
                    className={`flex items-center gap-2 w-full pl-5 pr-3 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                      nb.parentId === null
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-slate-600 dark:text-slate-300'
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
                    {nb.parentId === null && <span className="text-[10px] text-slate-400 ml-auto">(current)</span>}
                  </button>

                  {sortNotebooksTree(moveTargets).map(({ notebook: target, depth }) => (
                    <button
                      key={target.id}
                      className={`flex items-center gap-2 w-full pr-3 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                        nb.parentId === target.id
                          ? 'text-slate-400 dark:text-slate-500'
                          : 'text-slate-600 dark:text-slate-300'
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
                      {nb.parentId === target.id && <span className="text-[10px] text-slate-400 ml-auto">(current)</span>}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700 mx-0 my-0.5" />
              </div>
            )}

            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                onCreateNote(nb.id);
                onContextMenu(null);
              }}
            >
              <FilePlus className="w-3.5 h-3.5" /> New note
            </button>

            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                onCreateChild(nb.id);
                onContextMenu(null);
              }}
            >
              <FolderPlus className="w-3.5 h-3.5" /> New sub-notebook
            </button>

            <div className="border-t border-slate-100 dark:border-slate-700 my-1" />

            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-500 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700"
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
