# RoadbookNavi review context

Read `ARCHITECTURE.md` for the current boundaries. This is a local Tauri app:
TypeScript/React UI, pure algorithms in `src/core`, Rust/SQLite persistence, and
BRouter on desktop and Android. There is no application server.

When affected by the PR, trace coordinate order and units, RN2 compatibility,
storage migrations, routing retries, cancellation, and TypeScript/Rust/Java
contracts. Keep `src/core` independent of UI, storage and native runtimes.
Existing project data and saved routes must remain usable after updates.

For export changes, check longitude/latitude order at the file-format boundary.
