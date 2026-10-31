import { describe, expect, it } from 'vitest';
import { readPdfTextItems } from './pdfText';

describe('PDF text extraction on Safari and desktop WebKit', () => {
  it('reads all chunks without ReadableStream async iteration', async () => {
    const marker = {
      str: '#40',
      dir: 'ltr',
      width: 2,
      height: 1,
      transform: [1, 0, 0, 1, 6, 1948.15],
      fontName: 'helvetica',
      hasEOL: false,
    };
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({ items: [marker] });
        controller.enqueue({
          items: [{ ...marker, str: 'Finish', height: 8 }],
        });
        controller.close();
      },
    });
    Object.defineProperty(stream, Symbol.asyncIterator, { value: undefined });
    expect(Reflect.get(stream, Symbol.asyncIterator)).toBeUndefined();
    const items = await readPdfTextItems({ streamTextContent: () => stream });
    expect(items.map(item => 'str' in item && item.str)).toEqual([
      '#40',
      'Finish',
    ]);
    expect(stream.locked).toBe(false);
  });

  it('propagates extraction errors and releases the stream lock', async () => {
    const error = new Error('PDF text stream failed');
    const stream = new ReadableStream({
      start(controller) {
        controller.error(error);
      },
    });
    await expect(
      readPdfTextItems({ streamTextContent: () => stream })
    ).rejects.toBe(error);
    expect(stream.locked).toBe(false);
  });
});
