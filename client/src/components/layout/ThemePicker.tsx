import { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { useTheme, THEMES, themeLabels, type Theme } from '../../contexts/ThemeContext';

const themeSwatches: Record<Theme, { bg: string; accent: string }> = {
  light:    { bg: '#f8fafc', accent: '#2563eb' },
  dark:     { bg: '#0f172a', accent: '#60a5fa' },
  claude:   { bg: '#ece7de', accent: '#8a7259' },
  evernote: { bg: '#f7f7f5', accent: '#00a82d' },
  terminal: { bg: '#0c0c0c', accent: '#3bce5a' },
};

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-hover rounded-md transition-colors"
      >
        <Palette className="w-4 h-4" />
        Theme: {themeLabels[theme]}
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 bg-card border border-edge rounded-lg shadow-xl py-1.5 min-w-[180px] z-50">
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => { setTheme(t); setIsOpen(false); }}
              className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm transition-colors ${
                t === theme ? 'text-accent bg-hover' : 'text-ink-secondary hover:bg-hover'
              }`}
            >
              <span
                className="flex w-5 h-5 rounded-full overflow-hidden border border-edge shrink-0"
              >
                <span style={{ background: themeSwatches[t].bg }} className="w-1/2 h-full" />
                <span style={{ background: themeSwatches[t].accent }} className="w-1/2 h-full" />
              </span>
              {themeLabels[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
