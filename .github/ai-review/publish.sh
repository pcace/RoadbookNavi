#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail

python3 "$(dirname "$0")/review.py" publish
