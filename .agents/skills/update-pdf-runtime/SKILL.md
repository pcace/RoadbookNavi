---
name: update-pdf-runtime
description: Update or troubleshoot RoadbookNavi's React-PDF and PDF.js integration, including a PDF that stays on the loading spinner after route creation. Use when changing react-pdf, pdfjs-dist, PDF worker bundling, or RoadbookPdfViewer.
---

# Update the RoadbookNavi PDF runtime

## Recurring failure

On 2026-10-27, a newly created route reached “Lade PDF…” and never displayed
its roadbook. A plain section spinner could replace the viewer. PDF generation
itself succeeded. React-PDF 11.0.0 loaded PDF.js **6.3.289**, while the separately
installed `pdfjs-dist` supplied worker **6.4.299**. The incompatible worker
protocol stalled initialization; a reproduced console error was
`Unknown action from worker: test`.

The user reports this failure has occurred on an earlier PDF library update too.
Treat the versions above as the recorded incident, not permanent upgrade targets.

## Compatibility contract

- Derive the PDF.js version from the installed React-PDF dependency metadata and
  actual module resolution. The viewer API and worker must have **exactly the
  same version**, not just compatible major versions. Keep the direct
  `pdfjs-dist` dependency pinned to that version and update `pnpm-lock.yaml`
  together. Prefer upgrading React-PDF to a compatible release over forcing a
  different transitive PDF.js version with an override.
- Keep worker configuration in `src/ui/components/RoadbookPdfViewer.tsx`, the
  module that renders `Document` and `Page`. Bundle the local worker through
  Vite's `pdfjs-dist/build/pdf.worker.min.mjs?worker&url` import and assign it to
  `pdfjs.GlobalWorkerOptions.workerSrc`. Do not replace it with a remote CDN
  worker; the desktop app must ship its worker.
- Preserve `suspense={false}` on `Document` while this viewer uses loading and
  error callbacks. React-PDF 11 defaults to Suspense; changing this deliberately
  also requires checking the section boundary in `MainContent.tsx`.
- Preserve document source/load errors, asynchronous page-metadata errors, and
  individual page load/render errors as visible error states. Keep the
  state-owned PDF bytes intact: the separate index reader passes a copy because
  PDF.js can transfer and detach typed-array buffers.

Relevant files: `package.json`, `pnpm-lock.yaml`, `src/pdf-runtime.test.ts`,
`src/ui/components/RoadbookPdfViewer.tsx`, `src/ui/services/localProjects.ts`,
and `src/export.ts`.

## Verify an update

Run the focused compatibility test first:

```sh
pnpm exec vitest run src/pdf-runtime.test.ts
```

Then run `pnpm install --frozen-lockfile`, `pnpm format:check`,
`pnpm type-check`, `pnpm test`, and `pnpm build`. Inspect the build output for
an emitted PDF worker asset. The compatibility test compares the worker's embedded
version with the PDF.js module resolved from React-PDF; retain this guard.

Exercise the real PDF generation and `Document`/`Page` rendering path:

1. Open a newly generated roadbook, bypassing the cache with a fresh test route.
2. Open the same roadbook again from its PDF/index cache.
3. Use a long roadbook (40 entries produced three screen pages in this incident),
   scroll to later pages, and verify that their canvases actually render.
4. Supply invalid PDF bytes in an isolated test fixture and verify a visible
   error instead of an endless spinner.

Build the desktop artifact as well: `pnpm desktop:build --bundles app` on macOS,
otherwise the platform's supported desktop build command. Check the **newly built**
app, not an older installed copy. A running process, successful PDF generation,
or a passing unit test alone does not establish that the PDF is displayed.

If native UI testing is unavailable, a temporary browser fixture may mock native
project persistence while retaining real PDF generation, worker loading, and
viewer rendering. Remove temporary fixture files before committing and report
that native UI behavior was not directly verified. Do not alter users' saved
routes or clear their cache as a substitute for fixing the protocol mismatch.

References: [React-PDF worker setup](https://github.com/wojtekmaj/react-pdf#configure-pdfjs-worker)
and [PDF.js version matching FAQ](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions).
