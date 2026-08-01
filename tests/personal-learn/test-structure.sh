#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
skill_dir="$repo_root/.agents/skills/personal-learn"

required_files='SKILL.md
assets/personal-learn-config.template.yaml
references/editorial-policy.md
references/markdown-quality.md
references/demo-quality.md
references/exercise-quality.md
scripts/init-config.sh
scripts/validate-config.sh
evals/evals.json'

printf '%s\n' "$required_files" | while IFS= read -r relative_path; do
  test -f "$skill_dir/$relative_path" || {
    echo "FAIL: missing $skill_dir/$relative_path" >&2
    exit 1
  }
done

test -f "$repo_root/personal-learn-config.yaml" || {
  echo "FAIL: missing root personal-learn-config.yaml" >&2
  exit 1
}

grep -q '^name: personal-learn$' "$skill_dir/SKILL.md"
grep -q 'Always let the user choose' "$skill_dir/SKILL.md"
grep -q 'ask two separate questions' "$skill_dir/SKILL.md"
grep -q 'For non-technical topics, skip both' "$skill_dir/SKILL.md"

understand_line=$(grep -n '^### 1\. Understand$' "$skill_dir/SKILL.md" | cut -d: -f1)
level_line=$(grep -n '^### 2\. Ask for a level$' "$skill_dir/SKILL.md" | cut -d: -f1)
classify_line=$(grep -n '^### 3\. Classify the topic$' "$skill_dir/SKILL.md" | cut -d: -f1)
if [ "$understand_line" -ge "$level_line" ] || [ "$level_line" -ge "$classify_line" ]; then
  echo "FAIL: required interaction is out of order" >&2
  exit 1
fi

for reference in editorial-policy markdown-quality demo-quality exercise-quality; do
  grep -q "references/$reference.md" "$skill_dir/SKILL.md" || {
    echo "FAIL: SKILL.md does not route to $reference.md" >&2
    exit 1
  }
done

test ! -e "$repo_root/EDITORIAL_GUIDE.md" || {
  echo "FAIL: EDITORIAL_GUIDE.md still exists" >&2
  exit 1
}
test ! -e "$repo_root/READER_PROFILE.md" || {
  echo "FAIL: READER_PROFILE.md still exists" >&2
  exit 1
}

if grep -Eq '知识地图|EDITORIAL_GUIDE|READER_PROFILE' "$repo_root/README.md"; then
  echo "FAIL: README still contains navigation or legacy guidance" >&2
  exit 1
fi

readme_heading_count=$(grep -c '^#' "$repo_root/README.md")
if [ "$readme_heading_count" -ne 1 ]; then
  echo "FAIL: README contains sections beyond the project introduction" >&2
  exit 1
fi

echo "PASS: personal-learn structure contract"
