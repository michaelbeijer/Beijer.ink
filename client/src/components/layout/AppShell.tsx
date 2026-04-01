import { useState, useCallback, useEffect } from 'react';
import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { DragOverlayContent } from './DragOverlayContent';
import { ResizeDivider } from './ResizeDivider';
import { NoteEditor } from '../editor/NoteEditor';
import { Scratchpad } from '../scratchpad/Scratchpad';
import { GlobalSearchDialog } from '../search/GlobalSearchDialog';
import { SettingsDialog } from '../settings/SettingsDialog';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useDndNotebooks } from '../../hooks/useDndNotebooks';
import { useResizePanel } from '../../hooks/useResizePanel';
import { getNoteById } from '../../api/notes';
import { getNotebooks } from '../../api/notebooks';

type MobileView = 'sidebar' | 'editor';

export function AppShell() {
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editorSearchQuery, setEditorSearchQuery] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('editor');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const toggleFullscreen = useCallback(() => setIsFullscreen((prev) => !prev), []);
  const { width: sidebarWidth, handleMouseDown: handleResizeMouseDown } = useResizePanel();

  const { data: notebooks = [] } = useQuery({
    queryKey: ['notebooks'],
    queryFn: getNotebooks,
  });

  const {
    sensors,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useDndNotebooks(notebooks);

  const handleSelectNotebook = useCallback((id: string) => {
    setSelectedNotebookId(id);
  }, []);

  const handleSelectNote = useCallback((id: string) => {
    setSelectedNoteId(id);
    setEditorSearchQuery(null);
    setMobileView('editor');
  }, []);

  const handleSelectRootNote = useCallback((noteId: string) => {
    setSelectedNotebookId(null);
    setSelectedNoteId(noteId);
    setEditorSearchQuery(null);
    setMobileView('editor');
  }, []);

  const handleNoteDeleted = useCallback(() => {
    setSelectedNoteId(null);
    setMobileView('sidebar');
  }, []);

  const handleSearchSelectNote = useCallback(async (noteId: string, query: string) => {
    const note = await getNoteById(noteId);
    if (note) {
      setSelectedNotebookId(note.notebookId);
      setSelectedNoteId(noteId);
      setEditorSearchQuery(query);
      setMobileView('editor');
    }
  }, []);

  const handleClearEditorSearch = useCallback(() => {
    setEditorSearchQuery(null);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setShowSearch(true);
  }, []);

  // Ctrl+K to toggle search dialog
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Desktop: 3-column layout
  if (isDesktop) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="h-screen flex bg-surface">
          {!isFullscreen && (
            <>
              <div className="shrink-0" style={{ width: sidebarWidth }}>
                <Sidebar
                  selectedNotebookId={selectedNotebookId}
                  selectedNoteId={selectedNoteId}
                  onSelectNotebook={handleSelectNotebook}
                  onSelectNote={handleSelectNote}
                  onSelectRootNote={handleSelectRootNote}
                  autoExpandNotebookId={selectedNotebookId}
                  onOpenSettings={() => setShowSettings(true)}
                />
              </div>
              <ResizeDivider onMouseDown={handleResizeMouseDown} />
            </>
          )}

          {/* Editor */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center px-4 py-2 bg-panel border-b border-edge">
              <button
                onClick={handleOpenSearch}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted-bg border border-edge rounded-lg text-sm text-ink-muted hover:border-edge transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>Search all notes...</span>
                <kbd className="ml-4 text-xs bg-muted-bg px-1 py-0.5 rounded">Ctrl+K</kbd>
              </button>
            </div>

            <div className="flex-1 min-h-0">
              {selectedNoteId ? (
                <NoteEditor
                  noteId={selectedNoteId}
                  onNoteDeleted={handleNoteDeleted}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={toggleFullscreen}
                  searchQuery={editorSearchQuery}
                  onClearSearch={handleClearEditorSearch}
                />
              ) : (
                <Scratchpad />
              )}
            </div>
          </div>

          <GlobalSearchDialog
            isOpen={showSearch}
            onClose={() => setShowSearch(false)}
            onSelectNote={handleSearchSelectNote}
          />
          <SettingsDialog
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem && <DragOverlayContent activeItem={activeItem} />}
        </DragOverlay>
      </DndContext>
    );
  }

  // Mobile / Tablet
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-screen flex flex-col bg-surface">
        <TopBar
          onOpenSearch={handleOpenSearch}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className="flex-1 min-h-0 relative">
          {sidebarOpen && !isDesktop && (
            <>
              <div className="absolute inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-72 z-40">
                <Sidebar
                  selectedNotebookId={selectedNotebookId}
                  selectedNoteId={selectedNoteId}
                  onSelectNotebook={handleSelectNotebook}
                  onSelectNote={(noteId) => {
                    handleSelectNote(noteId);
                    setSidebarOpen(false);
                  }}
                  onSelectRootNote={(id) => {
                    handleSelectRootNote(id);
                    setSidebarOpen(false);
                  }}
                  onOpenSettings={() => { setShowSettings(true); setSidebarOpen(false); }}
                />
              </div>
            </>
          )}

          {mobileView === 'sidebar' && (
            <Sidebar
              selectedNotebookId={selectedNotebookId}
              selectedNoteId={selectedNoteId}
              onSelectNotebook={handleSelectNotebook}
              onSelectNote={handleSelectNote}
              onSelectRootNote={handleSelectRootNote}
              onOpenSettings={() => setShowSettings(true)}
            />
          )}

          {mobileView === 'editor' && (
            selectedNoteId ? (
              <NoteEditor
                noteId={selectedNoteId}
                onNoteDeleted={handleNoteDeleted}
                searchQuery={editorSearchQuery}
                onClearSearch={handleClearEditorSearch}
              />
            ) : (
              <Scratchpad />
            )
          )}
        </div>

        <MobileNav
          activeView={mobileView}
          onChangeView={setMobileView}
          hasNote={!!selectedNoteId}
        />

        <GlobalSearchDialog
          isOpen={showSearch}
          onClose={() => setShowSearch(false)}
          onSelectNote={handleSearchSelectNote}
        />
        <SettingsDialog
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem && <DragOverlayContent activeItem={activeItem} />}
      </DragOverlay>
    </DndContext>
  );
}
