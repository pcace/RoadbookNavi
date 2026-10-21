#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail

review_directory="$RUNNER_TEMP/ai-review"
jq -e --argjson number "$PR_NUMBER" --arg head "$HEAD_SHA" \
  '.number == $number and .head_sha == $head' "$review_directory/result.json" >/dev/null
pr=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER")
if ! jq -e --arg head "$HEAD_SHA" '.state == "open" and .draft == false and .head.sha == $head' <<< "$pr" >/dev/null; then
  echo 'Skipped publication: PR closed, draft, or newer commit exists.'
  exit 0
fi
python3 "$(dirname "$0")/review.py" render
jq -n --rawfile body "$review_directory/comment.md" '{body: $body}' > "$review_directory/comment.json"
comments=$(gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments?per_page=100" \
  --jq '.[] | select(.user.login == "github-actions[bot]" and (.body | startswith("<!-- roadbooknavi-ai-pr-review -->"))) | .id')
comment_id=${comments%%$'\n'*}
if [[ -n "$comment_id" ]]; then
  gh api --silent --method PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$comment_id" \
    --input "$review_directory/comment.json"
else
  gh api --silent --method POST "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" \
    --input "$review_directory/comment.json"
fi
