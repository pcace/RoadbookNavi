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
