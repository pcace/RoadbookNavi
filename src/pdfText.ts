import type {
  PDFPageProxy,
  TextContent,
} from 'pdfjs-dist/types/src/display/api';

// PDF.js getTextContent uses async iteration over ReadableStream, which is
// unavailable in some Safari and desktop WebKit versions. The reader API works
// there too, and preserves the invisible markers used by the roadbook viewer.
export async function readPdfTextItems(
  page: Pick<PDFPageProxy, 'streamTextContent'>
): Promise<TextContent['items']> {
  const reader = page.streamTextContent().getReader();
  const items: TextContent['items'] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return items;
      items.push(...value.items);
    }
  } finally {
    reader.releaseLock();
  }
}
