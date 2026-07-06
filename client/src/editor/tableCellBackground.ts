import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

// A per-cell background colour, stored as an inline style so it round-trips
// through the saved HTML and shows in the read-only view too. Applied to the
// selected cell(s) via the table extension's `setCellAttribute` command.
const backgroundColorAttribute = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
    renderHTML: (attributes: { backgroundColor?: string | null }) =>
      attributes.backgroundColor
        ? { style: `background-color: ${attributes.backgroundColor}` }
        : {},
  },
};

export const TableCellWithBackground = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...backgroundColorAttribute };
  },
});

export const TableHeaderWithBackground = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...backgroundColorAttribute };
  },
});
