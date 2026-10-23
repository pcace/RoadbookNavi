# Routing preview contract examples

These isolated helpers demonstrate preview state and remaining-time calculations.
They are not imported or executed by RoadbookNavi. Do not merge this test PR.

Requests for the same route may overlap: an older response must never replace a
newer request's preview. Route IDs alone do not identify a request. Remaining time
combines planned minutes with elapsed seconds. Zero coordinates remain valid.
