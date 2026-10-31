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

DNS is maintained in `ServerAsCode/ansible/vars/dns-zones.yml`. The apex has
GitHub Pages' four IPv4 and four IPv6 addresses, and `www` is a CNAME to
`pcace.github.io.`. There is no beta DNS record or separate hosting repository.

Stable `main` currently contains the landing page and native downloads. The
browser application becomes public when its changes are promoted to `main`.
