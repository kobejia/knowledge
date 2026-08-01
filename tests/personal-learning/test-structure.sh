#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
skill_dir="$repo_root/.agents/skills/personal-learning"

required_files='SKILL.md
assets/personal-learning-config.template.yaml
references/editorial-policy.md
references/markdown-quality.md
references/practice-quality.md
references/visual-policy.md
scripts/init-config.sh
scripts/validate-config.sh
evals/evals.json'

printf '%s\n' "$required_files" | while IFS= read -r relative_path; do
  test -f "$skill_dir/$relative_path" || {
    echo "FAIL: missing $skill_dir/$relative_path" >&2
    exit 1
  }
done

test -f "$repo_root/personal-learning-config.yaml" || {
  echo "FAIL: missing root personal-learning-config.yaml" >&2
  exit 1
}

test -f "$repo_root/personal-learning-knowledge.json" || {
  echo "FAIL: missing personal-learning-knowledge.json" >&2
  exit 1
}

for relative_path in \
  learn/frontend/vue/vuex-pinia.md \
  learn/frontend/browser/chrome-extension-architecture.md \
  learn/ai/tools/codex-high-efficiency-guide.md \
  learn/reference/awards/awards-catalog.md
do
  test -f "$repo_root/$relative_path" || {
    echo "FAIL: missing $relative_path" >&2
    exit 1
  }
done

for old_path in vue browser ai awards; do
  test ! -e "$repo_root/$old_path" || {
    echo "FAIL: old path remains: $old_path" >&2
    exit 1
  }
done

grep -q '^name: personal-learning$' "$skill_dir/SKILL.md"
grep -q '^description: .*本仓库' "$skill_dir/SKILL.md"
grep -q '^# 个人学习$' "$skill_dir/SKILL.md"
grep -q '^## 概述$' "$skill_dir/SKILL.md"
grep -q '必须由用户选择' "$skill_dir/SKILL.md"
grep -q '进阶（`advanced`）' "$skill_dir/SKILL.md"
grep -q '需要完整配套实践（可运行 Demo + 配套练习题）' "$skill_dir/SKILL.md"
grep -q '每一步需要用户决策时' "$skill_dir/SKILL.md"
grep -q '1\. 确认并继续' "$skill_dir/SKILL.md"
grep -q '2\. 返回调整' "$skill_dir/SKILL.md"
grep -q '3\. 自定义输入' "$skill_dir/SKILL.md"
grep -q '1\. \*\*专家（`expert`）\*\*' "$skill_dir/SKILL.md"
grep -q '5\. \*\*了解（`survey`）\*\*' "$skill_dir/SKILL.md"
grep -q '非技术主题.*跳过.*实践' "$skill_dir/SKILL.md"
grep -q 'personal-learning-knowledge.json' "$skill_dir/SKILL.md"
grep -q 'classificationMode' "$skill_dir/SKILL.md"
grep -q 'references/visual-policy.md' "$skill_dir/SKILL.md"
grep -q '从仓库根目录运行 `npm run check`' "$skill_dir/SKILL.md"
grep -q '不要把运行命令转交给用户' "$skill_dir/SKILL.md"
grep -q '检查未通过时不得宣称完成' "$skill_dir/SKILL.md"

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
grep -q '^# 可视化质量规范$' "$skill_dir/references/visual-policy.md"
grep -q '`advanced` | 进阶' "$skill_dir/references/editorial-policy.md"
grep -q 'advanced' "$skill_dir/references/markdown-quality.md"
grep -q 'advanced' "$skill_dir/references/practice-quality.md"

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

echo "PASS: personal-learning structure contract"
