import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, CalendarRange } from 'lucide-react';
import type { Board, Label } from '../../types/board';
import { createCard, updateCard, updateBoard } from '../../api/boards';
import { mondayOfIsoWeek, dayToISO } from '../../utils/calendar';

interface YearImportDialogProps {
  board: Board;
  year: number | null;
  onSetYear: (y: number | null) => void;
  onClose: () => void;
}

interface ParsedCard {
  title: string;
  labelName: string;
}
interface ParsedWeek {
  week: number;
  cards: ParsedCard[];
}

// Label name → palette colour (keys of LABEL_COLORS).
const LABEL_PALETTE: Record<string, string> = {
  Earnings: 'green',
  Notes: 'blue',
  "Michael's health": 'orange',
  "Jen's health": 'purple',
};

/** Pull the ENML out of an Evernote .enex CDATA block; otherwise return as-is. */
function extractHtml(text: string): string {
  const i = text.indexOf('CDATA[');
  if (i !== -1) {
    const j = text.indexOf(']]>', i);
    if (j !== -1) return text.slice(i + 6, j);
  }
  return text;
}

/** Parse a weekly table (Week N | EUR | GBP | After…tax | Notes | …health) into weeks of cards. */
function parseWeeks(text: string): ParsedWeek[] {
  const doc = new DOMParser().parseFromString(extractHtml(text), 'text/html');
  const table = doc.querySelector('table');
  if (!table) return [];

  type Col = { idx: number; kind: 'num' | 'bullets'; label?: string };
  let cols: Col[] = [];
  let weekColIdx = 0;
  const weeks: ParsedWeek[] = [];

  for (const row of Array.from(table.querySelectorAll('tr'))) {
    const cells = Array.from(row.querySelectorAll('td, th'));
    if (cells.length === 0) continue;
    const text0 = (cells[0].textContent || '').trim();

    // Header row: maps columns. (The table repeats its header; only the first matters.)
    if (cols.length === 0 && cells.some((c) => /week\s*number/i.test(c.textContent || ''))) {
      cells.forEach((c, idx) => {
        const t = (c.textContent || '').trim().toLowerCase();
        if (/week\s*number/.test(t)) weekColIdx = idx;
        else if (t === 'eur' || t === 'gbp' || /after.*tax/.test(t)) cols.push({ idx, kind: 'num' });
        else if (t === 'notes') cols.push({ idx, kind: 'bullets', label: 'Notes' });
        else if (/michael/.test(t)) cols.push({ idx, kind: 'bullets', label: "Michael's health" });
        else if (/jen/.test(t)) cols.push({ idx, kind: 'bullets', label: "Jen's health" });
        else if (t) cols.push({ idx, kind: 'bullets', label: (c.textContent || '').trim() });
      });
      continue;
    }

    // Data row: needs a week number in the week column.
    const wm = ((cells[weekColIdx]?.textContent || text0).match(/(\d+)/));
    if (!wm) continue;
    const week = parseInt(wm[1], 10);
    if (!week) continue;

    const cards: ParsedCard[] = [];
    const numParts: string[] = [];
    for (const col of cols) {
      const cell = cells[col.idx];
      if (!cell) continue;
      if (col.kind === 'num') {
        const v = (cell.textContent || '').trim();
        if (v) numParts.push(v);
      } else {
        const lis = Array.from(cell.querySelectorAll('li'));
        const items = lis.length
          ? lis.map((li) => (li.textContent || '').trim())
          : (cell.textContent || '').split('\n').map((s) => s.trim());
        for (const it of items) if (it) cards.push({ title: it, labelName: col.label || '' });
      }
    }
    if (numParts.length) cards.unshift({ title: numParts.join(' · '), labelName: 'Earnings' });
    if (cards.length) weeks.push({ week, cards });
  }
  return weeks;
}

export function YearImportDialog({ board, year, onSetYear, onClose }: YearImportDialogProps) {
  const queryClient = useQueryClient();
  const [yearInput, setYearInput] = useState<number>(year ?? new Date().getFullYear());
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedWeek[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cardCount = parsed ? parsed.reduce((n, w) => n + w.cards.length, 0) : 0;

  function handlePreview() {
    setError(null);
    try {
      const weeks = parseWeeks(text);
      if (weeks.length === 0) {
        setError('No weekly table rows found. Paste the table HTML or the .enex contents.');
        setParsed(null);
        return;
      }
      setParsed(weeks);
    } catch {
      setError('Could not parse that — make sure it includes the weekly table.');
      setParsed(null);
    }
  }

  /** Ensure the board has the labels we tag cards with; returns name → labelId. */
  async function ensureLabels(): Promise<Map<string, string>> {
    const byName = new Map<string, string>();
    for (const l of board.labels) if (l.name) byName.set(l.name, l.id);
    const toAdd: Label[] = [];
    for (const [name, color] of Object.entries(LABEL_PALETTE)) {
      if (!byName.has(name)) {
        const id = crypto.randomUUID();
        toAdd.push({ id, name, color });
        byName.set(name, id);
      }
    }
    if (toAdd.length) await updateBoard(board.id, { labels: [...board.labels, ...toAdd] });
    return byName;
  }

  async function handleImport() {
    if (!parsed) return;
    const home = board.columns[0]?.id;
    if (!home) {
      setError('This board has no list to add cards to. Add a list first.');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: cardCount });
    try {
      const labelIdByName = await ensureLabels();
      let done = 0;
      for (const wk of parsed) {
        const iso = dayToISO(mondayOfIsoWeek(yearInput, wk.week));
        for (const card of wk.cards) {
          const created = await createCard(home, card.title);
          const labelId = labelIdByName.get(card.labelName);
          await updateCard(created.id, { dueDate: iso, labelIds: labelId ? [labelId] : [] });
          done += 1;
          setProgress({ done, total: cardCount });
        }
      }
      onSetYear(yearInput); // make it a year board so every week shows
      queryClient.invalidateQueries({ queryKey: ['board', board.id] });
      onClose();
    } catch (e) {
      setError('Import failed partway through: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />
      <div className="relative bg-surface rounded-xl shadow-2xl border border-edge w-full max-w-2xl mx-4 flex flex-col">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-edge">
          <CalendarRange className="w-5 h-5 text-accent" />
          <h2 className="flex-1 text-lg font-semibold text-ink">Year &amp; weekly import</h2>
          <button onClick={onClose} disabled={busy} className="p-1 text-ink-faint hover:text-ink rounded disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Year */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-ink">Year</label>
            <input
              type="number"
              value={yearInput}
              onChange={(e) => setYearInput(parseInt(e.target.value, 10) || yearInput)}
              className="w-28 px-2 py-1 text-sm bg-input-bg border border-edge rounded text-ink outline-none focus:border-accent"
            />
            <button
              onClick={() => { onSetYear(yearInput); }}
              className="px-3 py-1 text-sm bg-muted-bg text-ink rounded-md hover:bg-hover"
              title="Show every week of this year as a column (no import)"
            >
              Make this a {yearInput} board
            </button>
          </div>
          <p className="text-xs text-ink-muted">
            A year board shows all {isoLabel(yearInput)} weeks as columns in Kanban → Group by: Week, ready to fill.
          </p>

          {/* Paste */}
          <div>
            <label className="block text-sm text-ink mb-1">Paste your weekly table (Evernote HTML export, or the .enex contents)</label>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setParsed(null); }}
              rows={6}
              placeholder="Paste the table here…"
              className="w-full px-3 py-2 text-xs font-mono bg-input-bg border border-edge rounded-lg text-ink placeholder:text-placeholder outline-none focus:border-accent resize-y"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handlePreview}
                disabled={!text.trim() || busy}
                className="px-3 py-1.5 text-sm bg-muted-bg text-ink rounded-md hover:bg-hover disabled:opacity-50"
              >
                Preview
              </button>
              {parsed && (
                <span className="text-sm text-ink-muted">
                  {parsed.length} week{parsed.length === 1 ? '' : 's'} → {cardCount} card{cardCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {progress && <p className="text-sm text-ink-muted">Importing… {progress.done}/{progress.total}</p>}
        </div>

        <div className="px-5 py-3 border-t border-edge flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-3 py-1.5 text-sm text-ink-muted hover:text-ink rounded-lg disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!parsed || busy}
            className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? 'Importing…' : `Import ${cardCount || ''} card${cardCount === 1 ? '' : 's'}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}

function isoLabel(year: number): string {
  // 52 or 53 — cheap inline (avoids importing just for a label).
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const jan1 = new Date(year, 0, 1).getDay();
  return jan1 === 4 || (isLeap && jan1 === 3) ? '53' : '52';
}
