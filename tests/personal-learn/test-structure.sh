#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
skill_dir="$repo_root/.agents/skills/personal-learn"

required_files='SKILL.md
assets/personal-learn-config.template.yaml
references/editorial-policy.md
references/markdown-quality.md
references/practice-quality.md
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
grep -q '^description: .*本仓库' "$skill_dir/SKILL.md"
grep -q '^# 个人学习$' "$skill_dir/SKILL.md"
grep -q '^## 概述$' "$skill_dir/SKILL.md"
grep -q '必须由用户选择' "$skill_dir/SKILL.md"
grep -q '是否需要配套实践（可运行 Demo + 配套练习题）' "$skill_dir/SKILL.md"
grep -q '非技术主题.*跳过.*实践' "$skill_dir/SKILL.md"

if grep -q '是否需要 Demo\|是否需要练习题' "$skill_dir/SKILL.md"; then
  echo "FAIL: SKILL.md still asks separate Demo or exercise questions" >&2
  exit 1
fi

if grep -qi 'recommend' "$skill_dir/SKILL.md"; then
  echo "FAIL: SKILL.md still recommends a level" >&2
  exit 1
fi

understand_line=$(grep -n '^### 1\. 理解与消歧$' "$skill_dir/SKILL.md" | cut -d: -f1)
level_line=$(grep -n '^### 2\. 选择内容档位$' "$skill_dir/SKILL.md" | cut -d: -f1)
classify_line=$(grep -n '^### 3\. 判断主题类型$' "$skill_dir/SKILL.md" | cut -d: -f1)
if [ "$understand_line" -ge "$level_line" ] || [ "$level_line" -ge "$classify_line" ]; then
  echo "FAIL: required interaction is out of order" >&2
  exit 1
fi

for reference in editorial-policy markdown-quality practice-quality; do
  grep -q "references/$reference.md" "$skill_dir/SKILL.md" || {
    echo "FAIL: SKILL.md does not route to $reference.md" >&2
    exit 1
  }
done

test ! -e "$skill_dir/references/demo-quality.md" || {
  echo "FAIL: obsolete demo-quality.md still exists" >&2
  exit 1
}
test ! -e "$skill_dir/references/exercise-quality.md" || {
  echo "FAIL: obsolete exercise-quality.md still exists" >&2
  exit 1
}

grep -q '^# 编辑规范$' "$skill_dir/references/editorial-policy.md"
grep -q '^# Markdown 质量规范$' "$skill_dir/references/markdown-quality.md"
grep -q '^# 配套实践质量规范$' "$skill_dir/references/practice-quality.md"

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
