import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ChangePasswordSection } from './ChangePasswordSection';
import { DownloadBackupSection } from './DownloadBackupSection';
import { useBoolSetting, SETTING_CALENDAR_DENSITY_STRIP } from '../../hooks/useAppSettings';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2">
      <div className="min-w-0">
        <div className="text-sm text-ink">{label}</div>
        <div className="text-xs text-ink-muted">{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-muted-bg'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [densityStrip, setDensityStrip] = useBoolSetting(SETTING_CALENDAR_DENSITY_STRIP, true);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface rounded-xl shadow-2xl border border-edge w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge shrink-0">
          <h2 className="text-lg font-semibold text-ink">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-ink-faint hover:text-ink rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Account section */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2 px-4">
              Account
            </h3>
            <div className="space-y-1">
              <ChangePasswordSection />
            </div>
          </section>

          {/* Calendar section */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2 px-4">
              Calendar
            </h3>
            <ToggleRow
              label="Week density strip"
              description="Show the busy-ness overview row at the top of the mobile weekly calendar."
              checked={densityStrip}
              onChange={setDensityStrip}
            />
          </section>

          {/* Data section */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2 px-4">
              Data
            </h3>
            <div className="space-y-1">
              <DownloadBackupSection />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
