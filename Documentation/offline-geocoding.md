# Place search

RoadbookNavi always provides place search from installed OSM regions. Optional
online search can be enabled under **Settings → App**. It uses a configurable
Nominatim-compatible base URL and an optional user-provided token.

Search runs only after pressing Enter or the search button. Reverse geocoding runs
when the user places or finishes moving a waypoint. Responses are cached locally
in SQLite by provider URL, language, and query. Network failures fall back to the
installed map data or coordinates.

Requests originate from the device, use an identifying user agent, and are
limited to one request every 1.1 seconds per running app. The public OSMF service
has an application-wide usage policy and is unsuitable as a guaranteed provider
for a large public distribution. Distributors should choose a compatible service
whose terms allow direct app traffic, or ask users to configure their own token.

Provider tokens stay in local webview preferences. They are not a secure secret
because a distributed client cannot conceal a shared provider credential. Search
text, selected coordinates, and the device IP address are sent to the configured
provider when online lookup is enabled.
