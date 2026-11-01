# Testing

The frontend tests cover project data, RN2 import/export and route edits, geometry,
map decoding, PDF helpers, browser services, file exchange and handbook links.
Rust tests cover native storage, downloads, geographic caches, geocoding and
commands. There is no RoadbookNavi account service or database server to run.

## Automated checks

Run the checks used by frontend CI:

    pnpm format:check
    pnpm test
    pnpm test:release
    node --test scripts/website-downloads.test.mjs scripts/help-site.test.mjs
    pnpm build
    pnpm build:web

Both builds include TypeScript checking. The first uses native asset paths;
the second builds the public website, browser app and standalone help.

For native changes:

    cargo fmt --check --manifest-path src-tauri/Cargo.toml
    cargo test --locked --manifest-path src-tauri/Cargo.toml

Tests that are explicitly skipped or ignored are not evidence of a successful
hardware or end-to-end run. Routing, OS location access, native file dialogs,
wake-lock behaviour and suspend/resume still need testing on their target device.

## User workflow smoke test

Use an isolated local browser origin or a disposable test library. Use public
example locations, such as Adenau and Nürburg, rather than private routes.

1. Add at least two waypoints, choose a supplied profile and check the calculated
   preview. Save with a name and wait for the roadbook to render.
2. Return to the library and open it again. Show the odometer with the ruler
   button; verify that a tap on each half changes the distance in the expected
   direction. Read help, follow a chapter link and return with **Back to the app**;
   the odometer must retain its value. Test configured scroll keys with auto-follow disabled.
3. Use the planner's project actions to rename the roadbook. Open and cancel its
   delete dialog. The library's delete action currently has no confirmation, so
   test actual removal only with disposable data.
4. Export RN2, GPX, GeoJSON, A5 PDF and roll PDF. Open or inspect each output.
   Import the RN2 again and compare its entries and drawings.
5. Import a GPX as a planning template and compare the original underlay with the
   recalculated route. This does not promise an exact track match.
6. For RN2 route changes, verify retained and regenerated drawings against the
   original. Known unsupported manual distance corrections and smart tags must
   remain visible in the import notice and handbook.
7. On an installed app, repeat route calculation with cached area data and no
   connection. Test opening a saved roadbook offline. In the browser, test a
   loaded roadbook while keeping the page open; an offline cold start is not
   supported.

Use the [user handbook](public/help/en.md) as the expected control sequence.
Do not infer a working feature from an unused component or stored preference.

## Help and website smoke test

Serve the contents of dist-web with a local HTTP server.

- Follow the landing page's help link in both languages.
- Read the public help at /help/de/ and /help/en/ without launching the app.
- Open the in-app help from the question-mark button and through a direct
  chapter URL under /app/#/app/help?section=….
- Search for a topic, open a result, verify the chapter URL, and test a search
  with no matches.
- Check both desktop and narrow layouts. The mobile chapter menu must remain
  reachable and collapse after a selection. Tables must scroll within their
  container rather than widening the document.
- Open thumbnails, check full screenshots and arrow targets, close with Escape,
  and verify that keyboard focus returns to the triggering link.
- Check that ordered steps and bullet points remain visible inside Chakra's
  application styles as well as on the standalone site.
- Read the static help with JavaScript disabled. Chapter links and image links
  must still work; search and image dialogs are enhancements.

Screenshot sources and update steps are documented in [CONTRIBUTING.md](CONTRIBUTING.md).
