import { useState } from 'react';
import {
  FileText,
  Folder,
  MoreHorizontal,
  StarOff,
} from 'lucide-react';

interface SidebarFavoriteItemProps {
  id: string;
  type: 'notebook' | 'note';
  name: string;
  isSelected: boolean;
  contextMenuId: string | null;
  onSelect: () => void;
  onRemoveFavorite: () => void;
  onContextMenu: (id: string | null) => void;
}

export function SidebarFavoriteItem({
  id,
  type,
  name,
  isSelected,
  contextMenuId,
  onSelect,
  onRemoveFavorite,
  onContextMenu,
}: SidebarFavoriteItemProps) {
  const menuId = `fav-${id}`;
  const isMenuOpen = contextMenuId === menuId;

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(isMenuOpen ? null : menuId);
  }

  return (
    <div
      className={`group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors ${
        isSelected
          ? 'bg-active text-ink'
          : 'text-ink-secondary hover:bg-hover'
      }`}
      style={{ paddingLeft: '8px' }}
      onClick={onSelect}
      onContextMenu={handleContextMenu}
    >
      {type === 'notebook' ? (
        <Folder className="w-4 h-4 shrink-0 text-ink-faint" />
      ) : (
        <FileText className="w-4 h-4 shrink-0 text-ink-faint" />
      )}
      <span className="flex-1 text-sm truncate text-fav-text">{name}</span>

      <div className="relative">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(isMenuOpen ? null : menuId);
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
                onRemoveFavorite();
                onContextMenu(null);
              }}
            >
              <StarOff className="w-3.5 h-3.5" /> Remove from Favorites
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
