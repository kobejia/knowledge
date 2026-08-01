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

if grep -q '^level_recommendations:' "$repo_root/personal-learn-config.yaml" \
  || grep -q '^level_recommendations:' "$skill_dir/assets/personal-learn-config.template.yaml"; then
  echo "FAIL: level recommendations remain in personal config" >&2
  exit 1
fi

if "$skill_dir/scripts/init-config.sh" "$fixture_dir" >/dev/null 2>&1; then
  echo "FAIL: initializer overwrote an existing config" >&2
  exit 1
fi

cp "$fixture_dir/personal-learn-config.yaml" "$fixture_dir/unknown-field.yaml"
printf '\nlevel_recommendations:\n  known_technical_domains: expert\n' >> "$fixture_dir/unknown-field.yaml"
if "$skill_dir/scripts/validate-config.sh" "$fixture_dir/unknown-field.yaml" >/dev/null 2>&1; then
  echo "FAIL: validator accepted the removed level_recommendations field" >&2
  exit 1
fi

sed 's/frontend_years: 10/frontend_years: ten/' \
  "$fixture_dir/personal-learn-config.yaml" > "$fixture_dir/invalid-years.yaml"
if "$skill_dir/scripts/validate-config.sh" "$fixture_dir/invalid-years.yaml" >/dev/null 2>&1; then
  echo "FAIL: validator accepted non-integer experience" >&2
  exit 1
fi

echo "PASS: personal-learn configuration contract"
