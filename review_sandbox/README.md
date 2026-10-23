# Disposable reviewer exercise

This folder is an isolated code-review fixture, not application code. It is not
imported or executed by RoadbookNavi and this PR must never be merged.

Expected behavior:

- Remaining distance is the non-negative part of total minus travelled meters.
- The next waypoint follows the current waypoint. At the final waypoint, return
  `None` rather than indexing beyond the list.

The exercise will include human questions, follow-up commits and a final
no-functional-change push to observe review discussions and finding status.

- Kilometer conversion must preserve fractional distances: 1.5 km is 1500 m.

These examples stay separate from application imports and runtime execution.
