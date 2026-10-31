# Stable website

This directory is a dependency-free landing page for RoadbookNavi.

The source repository's Pages site serves `beta.roadbooknavi.de` from `dev`.
The stable site is hosted separately in `pcace/RoadbookNavi-stable`, so deploying
one channel cannot replace the other.

`.github/workflows/stable-pages.yml` publishes this directory after changes to
`docs/` on `main`, or a manual run on `main`. It replaces the published `CNAME`
with `roadbooknavi.de`, adds `.nojekyll`, and records the source commit in
`source.json`. Generated files go only to the hosting repository's `gh-pages`
branch. The checked-in beta `CNAME` stays compatible with the beta deployment.

The `stable-pages` environment allows only `main` and holds the
`STABLE_PAGES_DEPLOY_KEY` secret. Its public key has write access only to the
hosting repository. That repository uses branch-based Pages from `gh-pages` at
`/`, the custom domain `roadbooknavi.de`, and HTTPS enforcement.

DNS is managed in `ServerAsCode/ansible/vars/dns-zones.yml`. The apex has GitHub
Pages' four IPv4 and four IPv6 addresses; `www` is a CNAME to `pcace.github.io.`
and redirects to the apex. The beta CNAME also points to `pcace.github.io.` but
is associated with the source repository's independent Pages site.

`main` currently contains the stable landing page and native downloads. The
browser application is published only by `dev` at `beta.roadbooknavi.de/app/`.
