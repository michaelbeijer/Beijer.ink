import { useState, useRef, useEffect } from 'react';
import { ALargeSmall } from 'lucide-react';
import { useFontScale, FONT_SCALES, fontScaleLabels, type FontScale } from '../../contexts/FontScaleContext';

// A small preview glyph that grows with each step, mirroring the theme swatches.
const previewSize: Record<FontScale, string> = {
  default: '11px',
  large: '14px',
  larger: '17px',
};

export function TextSizePicker() {
  const { fontScale, setFontScale } = useFontScale();
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
        <ALargeSmall className="w-4 h-4" />
        Text size: {fontScaleLabels[fontScale]}
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 bg-card border border-edge rounded-lg shadow-xl py-1.5 min-w-[180px] z-50">
          {FONT_SCALES.map((s) => (
            <button
              key={s}
              onClick={() => { setFontScale(s); setIsOpen(false); }}
              className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm transition-colors ${
                s === fontScale ? 'text-accent bg-hover' : 'text-ink-secondary hover:bg-hover'
              }`}
            >
              <span
                className="flex items-center justify-center w-5 shrink-0 font-semibold leading-none"
                style={{ fontSize: previewSize[s] }}
              >
                A
              </span>
              {fontScaleLabels[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
