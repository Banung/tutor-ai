#!/usr/bin/env bash
# Reproduce two observed defects against the pinned original code, without changing this checkout.
set -euo pipefail
repo_root="$(git rev-parse --show-toplevel)"
baseline_dir="$(mktemp -d /tmp/tutor-ai-baseline.XXXXXX)"
trap 'rm -rf -- "$baseline_dir"' EXIT

git -C "$repo_root" archive 8832f46 | tar -x -C "$baseline_dir"
ln -s "$repo_root/node_modules" "$baseline_dir/node_modules"
mkdir -p "$baseline_dir/tests"
cp "$repo_root/tests/ai-provider.test.ts" "$baseline_dir/tests/provider.test.ts"
cp "$repo_root/tests/ai-service.test.ts" "$baseline_dir/tests/context.test.ts"

cd "$baseline_dir"
set +e
node_modules/.bin/tsx --test --test-name-pattern "after character 1400|Embedding 2 uses task prefixes" tests/provider.test.ts tests/context.test.ts > baseline.tap 2>&1
baseline_status=$?
set -e
# Require the expected assertions, not a missing dependency, import or network error.
if [ "$baseline_status" -eq 0 ] || ! rg -q 'not ok 1' baseline.tap || ! rg -q 'KODE-AKHIR: MERANTI-42' baseline.tap || ! rg -q 'task: question answering' baseline.tap; then
  cat baseline.tap
  echo 'Baseline did not fail for the two expected reasons.' >&2
  exit 1
fi
printf '%s\n' 'Verified baseline defects: missing query task prefix and missing chunk-tail evidence.'
