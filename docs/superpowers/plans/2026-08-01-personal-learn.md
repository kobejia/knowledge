# Personal Learn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the repository-local `personal-learn` skill, migrate the existing editorial rules and reader profile into the skill and its configuration, and leave README as project introduction only.

**Architecture:** `SKILL.md` orchestrates interaction and loads focused references. Personal preferences live in root `personal-learn-config.yaml`, initialized from a bundled template and validated by dependency-free Ruby-backed shell scripts. Shell tests verify configuration behavior, skill structure, migration completeness, and README boundaries before behavioral eval prompts are reviewed.

**Tech Stack:** Markdown, YAML, POSIX shell, system Ruby YAML parser, Git

---

### Task 1: Configuration tests and baseline

**Files:**
- Create: `tests/personal-learn/test-config.sh`
- Create: `tests/personal-learn/test-structure.sh`

- [ ] **Step 1: Write the failing configuration test**

Create a shell test that copies the skill to a temporary repository, asserts initialization creates `personal-learn-config.yaml`, asserts a second initialization refuses to overwrite it, validates the generated file, and verifies malformed or unsupported values fail validation.

```sh
#!/bin/sh
set -eu
repo_dir=$(mktemp -d)
trap 'rm -rf "$repo_dir"' EXIT
skill_dir="$PWD/.agents/skills/personal-learn"

test ! -e "$repo_dir/personal-learn-config.yaml"
"$skill_dir/scripts/init-config.sh" "$repo_dir"
"$skill_dir/scripts/validate-config.sh" "$repo_dir/personal-learn-config.yaml"
test -f "$repo_dir/personal-learn-config.yaml"
if "$skill_dir/scripts/init-config.sh" "$repo_dir"; then exit 1; fi
sed 's/known_technical_domains: expert/known_technical_domains: invalid/' \
  "$repo_dir/personal-learn-config.yaml" > "$repo_dir/invalid.yaml"
if "$skill_dir/scripts/validate-config.sh" "$repo_dir/invalid.yaml"; then exit 1; fi
```

- [ ] **Step 2: Write the failing structure test**

Assert all designed skill files exist, YAML frontmatter has `name: personal-learn`, references are routed from `SKILL.md`, root configuration exists, deleted legacy files are absent, and README contains neither the knowledge-map heading nor legacy links.

- [ ] **Step 3: Run tests to verify RED**

Run: `sh tests/personal-learn/test-config.sh && sh tests/personal-learn/test-structure.sh`

Expected: FAIL because `.agents/skills/personal-learn` and its root configuration do not exist.

- [ ] **Step 4: Commit failing tests**

```bash
git add tests/personal-learn
git commit -m "test: define personal learn skill contract"
```

### Task 2: Configuration template, initializer, and validator

**Files:**
- Create: `.agents/skills/personal-learn/assets/personal-learn-config.template.yaml`
- Create: `.agents/skills/personal-learn/scripts/init-config.sh`
- Create: `.agents/skills/personal-learn/scripts/validate-config.sh`
- Create: `personal-learn-config.yaml`

- [ ] **Step 1: Add the prefilled template**

Use schema version `1`, language `zh-CN`, the current learning goal, ten years of frontend experience, the four explicitly known domains, and level recommendations `expert`, `deep-dive`, `deep-dive`, and `survey`.

- [ ] **Step 2: Implement non-overwriting initialization**

Resolve the template relative to the script location, accept an optional repository directory defaulting to the current directory, copy only when the destination is absent, and return a non-zero exit with a clear message if it already exists.

- [ ] **Step 3: Implement YAML validation**

Use `ruby -ryaml` to require a mapping root, exact schema version `1`, non-empty language and goal, non-negative integer `frontend_years`, a non-empty string array for `known_domains`, and all four recommendations from `beginner`, `survey`, `deep-dive`, or `expert`. Print the failing field path and exit non-zero for invalid input.

- [ ] **Step 4: Initialize the repository config**

Run: `.agents/skills/personal-learn/scripts/init-config.sh "$PWD"`

Expected: `Created .../personal-learn-config.yaml`

- [ ] **Step 5: Verify GREEN for configuration**

Run: `sh tests/personal-learn/test-config.sh`

Expected: PASS with the invalid fixture rejected.

- [ ] **Step 6: Commit**

```bash
git add .agents/skills/personal-learn/assets .agents/skills/personal-learn/scripts personal-learn-config.yaml
git commit -m "feat: add personal learn configuration"
```

### Task 3: Skill orchestration and migrated policy

**Files:**
- Create: `.agents/skills/personal-learn/SKILL.md`
- Create: `.agents/skills/personal-learn/references/editorial-policy.md`
- Create: `.agents/skills/personal-learn/references/markdown-quality.md`
- Create: `.agents/skills/personal-learn/references/demo-quality.md`
- Create: `.agents/skills/personal-learn/references/exercise-quality.md`
- Create: `.agents/skills/personal-learn/evals/evals.json`

- [ ] **Step 1: Write realistic behavior eval prompts**

Include: clear frontend topic, ambiguous topic, survey selection, technical topic accepting both add-ons, technical topic rejecting add-ons, and non-technical topic. Each prompt describes the expected interaction or artifacts without embedding the implementation.

- [ ] **Step 2: Write minimal `SKILL.md`**

Use frontmatter name `personal-learn` and a trigger-only description. Require configuration validation first, then the fixed sequence: understand or disambiguate, ask for one of four levels, and only for technical topics separately ask about Demo and exercises. Route to the editorial and Markdown references always and the two add-on references only when selected.

- [ ] **Step 3: Migrate stable editorial policy**

Move every still-valid principle from both legacy files into `editorial-policy.md`, including problem/model-first writing, technical and non-technical focus, evidence classes, trade-offs, boundaries, source provenance, time sensitivity, adaptive structure, four level definitions, and prohibitions against invented user context.

- [ ] **Step 4: Add focused artifact references**

Put Markdown-only checks in `markdown-quality.md`, executable HTML/CSS/JavaScript constraints in `demo-quality.md`, and level-matched question/answer requirements in `exercise-quality.md`. Each file must contain a completion checklist and must not repeat the personal profile.

- [ ] **Step 5: Run structure test while legacy files remain**

Run: `sh tests/personal-learn/test-structure.sh`

Expected: FAIL only on legacy-file and README migration assertions; all skill structure assertions pass.

- [ ] **Step 6: Commit**

```bash
git add .agents/skills/personal-learn
git commit -m "feat: add personal learn skill"
```

### Task 4: Legacy migration and README cleanup

**Files:**
- Delete: `EDITORIAL_GUIDE.md`
- Delete: `READER_PROFILE.md`
- Modify: `README.md`

- [ ] **Step 1: Run a migration coverage comparison**

Compare every heading and checklist item in the two legacy files against the configuration template, `editorial-policy.md`, and artifact references. Add any missing effective rule before deletion.

- [ ] **Step 2: Delete legacy sources**

Remove both files only after the comparison is complete.

- [ ] **Step 3: Reduce README to project introduction**

Keep the project title and concise purpose statement. Remove the knowledge map, document links, editorial summary, and legacy-file links. Optionally mention that `personal-learn` assists research and writing, without embedding its manual.

- [ ] **Step 4: Verify GREEN for structure and migration**

Run: `sh tests/personal-learn/test-structure.sh`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md EDITORIAL_GUIDE.md READER_PROFILE.md tests/personal-learn/test-structure.sh
git commit -m "docs: migrate repository guidance to personal learn"
```

### Task 5: Full verification and documentation review

**Files:**
- Modify if needed: `.agents/skills/personal-learn/**`
- Modify if needed: `tests/personal-learn/**`

- [ ] **Step 1: Run the complete deterministic suite**

Run: `sh tests/personal-learn/test-config.sh && sh tests/personal-learn/test-structure.sh && git diff --check`

Expected: both test scripts PASS and `git diff --check` emits no output.

- [ ] **Step 2: Validate the live configuration directly**

Run: `.agents/skills/personal-learn/scripts/validate-config.sh personal-learn-config.yaml`

Expected: `Valid personal-learn config: personal-learn-config.yaml`

- [ ] **Step 3: Review skill quality**

Check frontmatter length and trigger coverage, ensure `SKILL.md` is concise, confirm all references are linked with conditions, scan for placeholders, and compare the eval prompts to the approved design.

- [ ] **Step 4: Run repository consistency searches**

Run: `rg -n 'EDITORIAL_GUIDE|READER_PROFILE|知识地图' --glob '!docs/superpowers/**' .`

Expected: no live repository references.

- [ ] **Step 5: Commit verification fixes if any**

```bash
git add .agents/skills/personal-learn tests/personal-learn personal-learn-config.yaml README.md
git commit -m "test: verify personal learn workflow"
```
