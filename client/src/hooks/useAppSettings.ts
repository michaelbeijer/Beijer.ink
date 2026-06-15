import { useState, useEffect, useCallback } from 'react';

// Lightweight global, localStorage-backed boolean settings with same-tab sync.
// (The browser 'storage' event only fires in *other* tabs, so we keep our own
// listener set to update every subscriber in the current tab too.)
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function useBoolSetting(key: string, fallback: boolean) {
  const full = `bink:setting:${key}`;
  const read = useCallback((): boolean => {
    try {
      const v = localStorage.getItem(full);
      return v === null ? fallback : v === '1';
    } catch {
      return fallback;
    }
  }, [full, fallback]);

  const [value, setValue] = useState(read);

  useEffect(() => {
    const l = () => setValue(read());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [read]);

  const set = useCallback(
    (v: boolean) => {
      try {
        localStorage.setItem(full, v ? '1' : '0');
      } catch {
        /* ignore quota / private-mode errors */
      }
      emit();
    },
    [full]
  );

  return [value, set] as const;
}

// Setting keys live here so the dialog and the consumers can't drift.
export const SETTING_CALENDAR_DENSITY_STRIP = 'calendarDensityStrip';
