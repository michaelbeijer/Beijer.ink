import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type FontScale = 'default' | 'large' | 'larger';

export const FONT_SCALES: FontScale[] = ['default', 'large', 'larger'];

export const fontScaleLabels: Record<FontScale, string> = {
  default: 'Default',
  large: 'Large',
  larger: 'Larger',
};

// Root font-size as a percentage of the browser default (≈16px). Using % rather
// than px keeps the user's own browser/OS font preference respected. Tailwind v4
// sizes both text AND spacing in rem, so changing the root size scales the whole
// UI together — text and buttons grow proportionally, keeping the layout intact.
//
// NOTE: keep these values in sync with the pre-paint script in client/index.html
// (it applies the saved size before React mounts to avoid a reflow flash).
export const fontScaleValues: Record<FontScale, string> = {
  default: '100%',
  large: '112.5%',
  larger: '125%',
};

interface FontScaleContextType {
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
}

const FontScaleContext = createContext<FontScaleContextType | null>(null);

const STORAGE_KEY = 'beijer-ink-font-scale';

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && FONT_SCALES.includes(stored as FontScale)) return stored as FontScale;
    return 'default';
  });

  useEffect(() => {
    document.documentElement.style.fontSize = fontScaleValues[fontScale];
    localStorage.setItem(STORAGE_KEY, fontScale);
  }, [fontScale]);

  const setFontScale = useCallback((scale: FontScale) => {
    setFontScaleState(scale);
  }, []);

  return (
    <FontScaleContext.Provider value={{ fontScale, setFontScale }}>
      {children}
    </FontScaleContext.Provider>
  );
}

export function useFontScale() {
  const context = useContext(FontScaleContext);
  if (!context) throw new Error('useFontScale must be used within FontScaleProvider');
  return context;
}
