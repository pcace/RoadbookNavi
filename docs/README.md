# Beta website and web app

`pnpm build:web` copies this landing page into `dist-web/` and builds the React
application at `dist-web/app/`. Native builds continue to use `pnpm build` and
`dist/`. No generated files are committed and no backend or server database is
needed. The browser calls brouter.de directly using the bundled Enduro profiles.

`.github/workflows/beta-pages.yml` builds and deploys only pushes to `dev` (or a
manual run on `dev`). It refuses to deploy unless the configured Pages domain is
exactly `beta.roadbooknavi.de`. Stable releases on `main` do not run this workflow.
The Online button is visible only on the beta domain and local previews.

GitHub repository setup:

1. In **Settings → Pages**, select **GitHub Actions** as the publishing source.
2. Keep the custom domain `beta.roadbooknavi.de` and HTTPS enabled.
3. Allow the `dev` branch to deploy to the `github-pages` environment if branch
   restrictions are configured.
4. Keep the DNS CNAME for `beta` pointing to `pcace.github.io`.

The artifact includes this directory's `CNAME` and the existing download links.
For a local preview, serve `dist-web/` using a static HTTP server and open `/`.
The Online button opens `/app/`; hash routes support refreshes without rewrites.

Projects are local to the browser and domain. Users should export RN2 backups;
there is no automatic native/browser synchronization. New routing needs internet
and the website has no service worker for offline restarts. Usage at beta launch
is expected to stay below ten visits per month. GPS navigation requires a visible
page and location permission. Built-in geocoding remains submit-only, with cached
responses and a serialized 1.1-second request interval in each browser; public
Nominatim limits apply to the entire application, so reassess before scaling.
