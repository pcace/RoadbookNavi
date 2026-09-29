# GitHub Pages setup

This directory is a dependency-free landing page for RoadbookNavi.

After the clean repository has been published:

1. Open **Settings → Pages** in GitHub.
2. Select **Deploy from a branch**.
3. Select the default branch and the `/docs` directory.
4. Set `beta.roadbooknavi.de` as the custom domain and enable HTTPS.
5. Create a DNS `CNAME` record for `beta` pointing to `pcace.github.io`.

The checked-in `CNAME` file tells GitHub Pages which custom domain to serve.
Release and issue links already target the new public repository.
The page links to the canonical GPL-3.0 license in that repository.
