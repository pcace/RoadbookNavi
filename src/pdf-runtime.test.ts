import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const reactPdfRequire = createRequire(require.resolve('react-pdf'));

describe('PDF runtime compatibility', () => {
  it('ships a worker with the exact PDF.js version used by React-PDF', () => {
    const viewerVersion = reactPdfRequire('pdfjs-dist/package.json').version;
    const worker = readFileSync(
      require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'),
      'utf8'
    );

    // A protocol mismatch can leave PDFWorker waiting for its initial handshake.
    expect(worker.match(/pdfjsVersion\s*=\s*([^\s]+)/)?.[1]).toBe(
      viewerVersion
    );
  });
});
