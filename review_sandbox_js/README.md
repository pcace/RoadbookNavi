# Disposable JavaScript reviewer exercise

This folder contains standalone review fixtures, not application code.
It is never imported by RoadbookNavi. This PR must not be merged.

Contracts:

- Travel time uses whole minutes and always rounds up fractional minutes.
- Renaming a route returns updated data without mutating any caller-owned input.
- Duplicate waypoint IDs are removed in first-occurrence order. IDs are
  case-sensitive; different casing is not a duplicate.

All inputs satisfy the contracts documented on each function. Do not infer
additional validation requirements. The exercise will include questions and
follow-up commits to observe review discussions and tracking of findings.

- Route dates use the UTC calendar date of a valid ISO timestamp ending in Z,
  independent of the device timezone.
