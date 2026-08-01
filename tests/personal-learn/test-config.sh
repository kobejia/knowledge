#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
skill_dir="$repo_root/.agents/skills/personal-learn"
fixture_dir=$(mktemp -d)
trap 'rm -rf "$fixture_dir"' EXIT HUP INT TERM

test ! -e "$fixture_dir/personal-learn-config.yaml"
"$skill_dir/scripts/init-config.sh" "$fixture_dir"
test -f "$fixture_dir/personal-learn-config.yaml"
"$skill_dir/scripts/validate-config.sh" "$fixture_dir/personal-learn-config.yaml"

if "$skill_dir/scripts/init-config.sh" "$fixture_dir" >/dev/null 2>&1; then
  echo "FAIL: initializer overwrote an existing config" >&2
  exit 1
fi

sed 's/known_technical_domains: expert/known_technical_domains: invalid/' \
  "$fixture_dir/personal-learn-config.yaml" > "$fixture_dir/invalid-level.yaml"
if "$skill_dir/scripts/validate-config.sh" "$fixture_dir/invalid-level.yaml" >/dev/null 2>&1; then
  echo "FAIL: validator accepted an invalid level" >&2
  exit 1
fi

sed 's/frontend_years: 10/frontend_years: ten/' \
  "$fixture_dir/personal-learn-config.yaml" > "$fixture_dir/invalid-years.yaml"
if "$skill_dir/scripts/validate-config.sh" "$fixture_dir/invalid-years.yaml" >/dev/null 2>&1; then
  echo "FAIL: validator accepted non-integer experience" >&2
  exit 1
fi

echo "PASS: personal-learn configuration contract"
