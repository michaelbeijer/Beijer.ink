import { useState } from 'react';
import {
  FileText,
  MoreHorizontal,
  Trash2,
  FolderInput,
  ChevronRight,
  ChevronDown,
  Folder,
} from 'lucide-react';
import type { NoteSummary } from '../../types/note';
import type { Notebook } from '../../types/notebook';
import { sortNotebooksTree } from '../../utils/sortNotebooksTree';

interface SidebarRootNoteProps {
  note: NoteSummary;
  isSelected: boolean;
  contextMenuId: string | null;
  notebooks: Notebook[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onContextMenu: (id: string | null) => void;
  onMoveToNotebook: (noteId: string, notebookId: string) => void;
}

export function SidebarRootNote({
  note,
  isSelected,
  contextMenuId,
  notebooks,
  onSelect,
  onDelete,
  onContextMenu,
  onMoveToNotebook,
}: SidebarRootNoteProps) {
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const isMenuOpen = contextMenuId === note.id;

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(isMenuOpen ? null : note.id);
  }

  return (
    <div
      className={`group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors ${
        isSelected
          ? 'bg-slate-200/70 dark:bg-slate-800/70 text-slate-900 dark:text-white'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
      }`}
      style={{ paddingLeft: '8px' }}
      onClick={() => onSelect(note.id)}
      onContextMenu={handleContextMenu}
    >
      <FileText className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
      <span className="flex-1 text-sm truncate">{note.title}</span>

      <div className="relative">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(isMenuOpen ? null : note.id);
          }}
          className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-opacity"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-6 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]">
            {/* Move to notebook */}
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
              <div className="border-t border-slate-100 dark:border-slate-700 mx-2 my-0.5">
                <div className="max-h-48 overflow-y-auto py-0.5">
                  {sortNotebooksTree(notebooks).map(({ notebook: target, depth }) => (
                    <button
                      key={target.id}
                      className="flex items-center gap-2 w-full pr-3 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      style={{ paddingLeft: `${depth * 12 + 20}px` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveToNotebook(note.id, target.id);
                        onContextMenu(null);
                      }}
                    >
                      <Folder className="w-3 h-3" />
                      <span className="truncate">{target.name}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700 mx-0 my-0.5" />
              </div>
            )}

            <div className="border-t border-slate-100 dark:border-slate-700 my-1" />

            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-500 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(note.id);
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
