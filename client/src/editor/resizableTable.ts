import { Table, TableView } from '@tiptap/extension-table';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// Live node view: mirror the table node's `fullWidth` attribute onto the DOM as
// `data-full-width`, so the CSS full-width toggle also applies while editing.
// The stock TableView only writes inline `style` onto the <table>, never
// arbitrary attributes, so a plain attribute would never reach the live DOM.
class FullWidthTableView extends TableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    super(node, cellMinWidth);
    this.syncFullWidth(node);
  }

  update(node: ProseMirrorNode): boolean {
    const handled = super.update(node);
    if (handled) this.syncFullWidth(node);
    return handled;
  }

  private syncFullWidth(node: ProseMirrorNode): void {
    if (node.attrs.fullWidth === false) {
      this.table.setAttribute('data-full-width', 'false');
    } else {
      this.table.removeAttribute('data-full-width');
    }
  }
}

// Table with a per-table "full width" toggle. Tables fill the editor width by
// default (attribute absent); toggling a table to natural width stores
// fullWidth=false, which renders `data-full-width="false"` and lets the CSS
// size it to its columns instead of stretching it across the pane.
export const ResizableTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fullWidth: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('data-full-width') === 'false' ? false : null,
        renderHTML: (attributes) =>
          attributes.fullWidth === false ? { 'data-full-width': 'false' } : {},
      },
    };
  },
}).configure({ resizable: true, View: FullWidthTableView });
