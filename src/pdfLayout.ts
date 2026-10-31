import type { TextContent } from 'pdfjs-dist/types/src/display/api';

export const ROADBOOK_ENTRY_HEIGHT = 100;

// Screen PDFs use fixed-size chunks. Their invisible, 1 pt entry markers let
// the viewer hide the unused end of the final chunk, including in cached PDFs.
export function roadbookContentHeight(
  pageHeight: number,
  items: TextContent['items']
): number {
  let contentBottom = 0;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!('str' in item) || item.height !== 1) continue;
    let marker = item.str.trim();
    const next = items[index + 1];
    if (marker === '#' && next && 'str' in next) marker += next.str.trim();
    if (!/^#\s*[1-9]\d*$/.test(marker)) continue;

    const top = pageHeight - item.transform[5];
    if (!Number.isFinite(top) || top < 0 || top >= pageHeight) continue;
    // The marker sits just inside the row; retain the entire row and its border.
    contentBottom = Math.max(contentBottom, top + ROADBOOK_ENTRY_HEIGHT);
  }
  return contentBottom ? Math.min(pageHeight, contentBottom) : pageHeight;
}
