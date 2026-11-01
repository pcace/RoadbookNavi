# Place search

Implementation notes; for usage, see the [handbook](../public/help/en.md).

Place search can be enabled under **Settings → App**. It uses a configurable
Nominatim-compatible base URL and an optional user-provided token. Address search
is unavailable without a connection; it is not required for routing or opening
saved roadbooks.

Search runs only after pressing Enter or the search button. Reverse geocoding runs
when the user places or finishes moving a waypoint. Native responses are cached locally
in SQLite by provider URL, language, and query. The browser adapter uses its
Cache API instead. Reverse-geocoding failures fall
back to coordinates.

Requests originate from the device. Native requests use an identifying user
agent; browser requests use the browser user agent. Each running adapter queues
requests with an interval of at least 1.1 seconds. The public OSMF service
has an application-wide usage policy and is unsuitable as a guaranteed provider
for a large public distribution. Distributors should choose a compatible service
whose terms allow direct app traffic, or ask users to configure their own token.

Provider tokens stay in local webview preferences. They are not a secure secret
because a distributed client cannot conceal a shared provider credential. Search
text, selected coordinates, and the device IP address are sent to the configured
provider when online lookup is enabled.
