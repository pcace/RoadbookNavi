# Live acceptance fixture

These files are only for testing the PR reviewer; the application never imports them.
On a temporary PR against the default branch:

1. Change `isFresh` to divide elapsed time by 1000 (unchanged caller supplies
   milliseconds), and `nextIndex` to cap at `count` (out-of-bounds result).
2. Expect two concrete inline findings, including evidence from `consumer.mjs`.
3. Reply in one thread, fix one bug and push. Expect an answer, recognition of the
   fix and no duplicate of the remaining bug.
4. Fix the second bug. Expect no new findings and verified closure of both issues.
5. Rerun without changes: no duplicate review. Edit a human question: a new answer.
6. Close the PR without merging. The deliberately broken fixtures never reach dev.

Also verify that a draft, a PR targeting another branch, and an unauthorized actor
cannot spend inference; stale and partial-publication cases have offline tests.
