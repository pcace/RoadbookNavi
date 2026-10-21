#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail

: "${OPENROUTER_API_KEY:?Set the OPENROUTER_API_KEY Actions secret}"
: "${GOOSE_IMAGE:?Set the pinned GOOSE_IMAGE}"
: "${GOOSE_MODEL:?Set the fixed free GOOSE_MODEL}"

review_directory="$RUNNER_TEMP/ai-review"
automation_directory="$(dirname "$(realpath "$0")")"
container_name="roadbooknavi-review-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
umask 077
trap 'docker rm -f "$container_name" >/dev/null 2>&1 || true' EXIT

# Reject changed pricing/model IDs before starting a model process.
python3 "$automation_directory/review.py" check-model
mkdir -p "$review_directory/goose-state"
session_arguments=()
if [[ "$(jq -r '.resumed' "$review_directory/resume.json")" == true ]]; then
  session_arguments=(--resume --session-id "$(jq -r '.session_id' "$review_directory/resume.json")")
else
  session_arguments=(--name "roadbooknavi-pr-$PR_NUMBER")
fi
run_nonce="$(jq -r '.run_nonce' "$review_directory/input.json")"

started=$SECONDS
exit_code=0
timeout --signal=TERM --kill-after=30s 15m docker run --rm --pull=missing \
  --name "$container_name" \
  --user "$(id -u):$(id -g)" \
  --cap-drop=ALL --security-opt=no-new-privileges \
  --read-only --tmpfs /tmp:rw,nosuid,size=1g \
  --workdir /workspace \
  --env HOME=/tmp/goose-home \
  --env XDG_DATA_HOME=/goose-state/data \
  --env XDG_CONFIG_HOME=/tmp/goose-config \
  --env XDG_STATE_HOME=/tmp/goose-state \
  --env GOOSE_PROVIDER=openrouter \
  --env GOOSE_MODEL \
  --env OPENROUTER_API_KEY \
  --env GOOSE_MODE=auto \
  --env GOOSE_DISABLE_KEYRING=1 \
  --env GOOSE_DISABLE_SESSION_NAMING=1 \
  --env GOOSE_TELEMETRY_ENABLED=false \
  --env GOOSE_CONTEXT_STRATEGY=summarize \
  --env 'OPENROUTER_PARAMETERS={"provider":{"max_price":{"prompt":0,"completion":0}},"max_tokens":12000}' \
  --volume "$GITHUB_WORKSPACE/repository:/workspace:ro" \
  --volume "$review_directory:/review-input:ro" \
  --volume "$review_directory/goose-state:/goose-state:rw" \
  --volume "$automation_directory/recipe.yaml:/recipe.yaml:ro" \
  --entrypoint /bin/sh \
  "$GOOSE_IMAGE" -c \
  'mkdir -p "$HOME" "$XDG_CONFIG_HOME" && run_nonce="$1" && shift && exec goose run --provider openrouter --model "$GOOSE_MODEL" --max-turns 40 --quiet --output-format json --recipe /recipe.yaml --params "architecture=$(cat /review-input/architecture.md)" --params "run=$run_nonce" "$@"' \
  sh "$run_nonce" "${session_arguments[@]}" \
  > "$RUNNER_TEMP/goose-review.json" 2> "$RUNNER_TEMP/goose-review.stderr" || exit_code=$?
python3 "$automation_directory/review.py" finish "$exit_code" "$((SECONDS - started))"
