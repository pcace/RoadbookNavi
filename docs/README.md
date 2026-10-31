# Production website

`roadbooknavi.de` is the single public website. GitHub Pages belongs to the
`pcace/RoadbookNavi` source repository and publishes only `main`, using
`.github/workflows/pages.yml`. `www.roadbooknavi.de` redirects to the apex.
The former beta website and `beta.roadbooknavi.de` have been retired. Beta
releases continue to be published as GitHub prereleases from `dev`.

The workflow copies this dependency-free landing page into `dist-web/`. Once
`main` includes the `build:web` script, it instead installs dependencies, tests,
and builds the landing page and browser app together. Each deployment writes
the production `CNAME`, `.nojekyll`, and `/source.json` with the source commit.
Generated files are uploaded as a Pages artifact and are not committed.

GitHub repository setup:

1. Select **GitHub Actions** as the Pages publishing source.
2. Set `roadbooknavi.de` as the custom domain and enable HTTPS.
3. Allow only `main` in the `github-pages` environment's branch policy.
4. Keep `pages.yml` on the default branch so manual runs can target `main`.

Configure the apex domain with GitHub Pages' four IPv4 and four IPv6 addresses,
and set `www` to a CNAME for `pcace.github.io.`. The website has no beta DNS
record and uses this repository's Pages site directly.

Stable `main` currently contains the landing page and native downloads. The
browser application becomes public when its changes are promoted to `main`.

For browser development, `pnpm build:web` builds the website and React app at
`dist-web/app/`. Native builds continue to use `pnpm build` and `dist/`. The
browser calls brouter.de with the bundled Enduro profiles and stores projects
locally in IndexedDB. Imports and exports use browser files and downloads.
Hash routes support refreshes without server rewrites. Serve `dist-web/` locally
and open `/app/` to preview work on `dev`. There is no public beta website.

Projects belong to the browser and domain; export RN2 backups. The browser app
has no native/browser synchronization or service worker. Routing requires an
internet connection; GPS navigation requires a visible page and location
permission. Geocoding is submit-only, cached, and serialized with a 1.1-second
request interval per browser; reassess public Nominatim usage before scaling.
