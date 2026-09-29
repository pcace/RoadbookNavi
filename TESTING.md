# Testing

The repository contains frontend unit tests and Rust tests for local storage,
OSM imports, downloads, and native commands. No database or API service is
required.

```bash
# Type-check, test, and bundle the React application
pnpm build
pnpm test

# Test the native layer
cargo test --manifest-path src-tauri/Cargo.toml
```

An optional real PBF fixture can exercise the ignored end-to-end OSM import:

```bash
OFFLINE_PBF_FIXTURE=/path/to/extract.osm.pbf \
  cargo test --manifest-path src-tauri/Cargo.toml -- --ignored --nocapture
```

Generated installers should also be smoke-tested on their target platform. A
release build must open the local project list, import an RN2 file, calculate a
route inside a downloaded region, render a roadbook, and export it again.
