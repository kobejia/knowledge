# Personal Learn Chinese Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize the visible personal-learning skill guidance into Chinese, remove configurable level recommendations, and tighten the configuration schema without breaking identifiers or paths.

**Architecture:** Keep `personal-learning`, reference paths, scripts, and internal level IDs stable. Move all human-facing skill guidance to Chinese, retain canonical level semantics in `editorial-policy.md`, and make the Ruby-backed validator reject unknown YAML keys while reading UTF-8 explicitly.

**Tech Stack:** Markdown, YAML, POSIX shell, Ruby YAML parser, Git

---

### Task 1: Add failing localization and schema tests

**Files:**
- Modify: `tests/personal-learning/test-config.sh`
- Modify: `tests/personal-learning/test-structure.sh`

- [ ] **Step 1: Replace the obsolete recommendation test**

Assert both live config and template omit `level_recommendations`. Create an invalid fixture by appending that old root key and assert validation fails. Retain the existing non-integer `frontend_years` rejection and non-overwrite initialization test.

- [ ] **Step 2: Add Chinese content assertions**

Assert `SKILL.md` has a Chinese `description`, Chinese headings for overview/setup/interaction, the ordered headings `### 1. 理解与消歧`, `### 2. 选择内容档位`, and `### 3. 判断主题类型`, plus Chinese titles in all four references. Continue asserting unchanged paths and `name: personal-learning`.

- [ ] **Step 3: Run tests to verify RED**

Run: `sh tests/personal-learning/test-config.sh && sh tests/personal-learning/test-structure.sh`

Expected: FAIL because recommendation fields still exist and skill content is English.

- [ ] **Step 4: Commit failing tests**

```bash
git add tests/personal-learning
git commit -m "test: define personal learn localization contract"
```

### Task 2: Remove recommendations and enforce strict UTF-8 schema

**Files:**
- Modify: `personal-learning-config.yaml`
- Modify: `.agents/skills/personal-learning/assets/personal-learning-config.template.yaml`
- Modify: `.agents/skills/personal-learning/scripts/validate-config.sh`

- [ ] **Step 1: Remove `level_recommendations`**

Delete the entire mapping from both config files. Keep `version`, `language`, and `learner` unchanged.

- [ ] **Step 2: Read YAML as UTF-8**

Change the parser input to:

```ruby
yaml = File.read(path, encoding: "UTF-8")
config = YAML.safe_load(yaml, permitted_classes: [], aliases: false)
```

Catch `Encoding::InvalidByteSequenceError` and `Encoding::UndefinedConversionError` together with YAML parse errors.

- [ ] **Step 3: Reject unknown keys**

Add a helper that compares mapping keys with allowed keys and reports the full field path. Permit only root `version/language/learner`, learner `goal/experience/known_domains`, and experience `frontend_years`. Delete recommendation parsing and level-value validation.

- [ ] **Step 4: Run config test to verify GREEN**

Run: `sh tests/personal-learning/test-config.sh`

Expected: PASS; generated config validates, overwrite is rejected, unknown legacy field and invalid years are rejected.

- [ ] **Step 5: Commit**

```bash
git add personal-learning-config.yaml .agents/skills/personal-learning/assets/personal-learning-config.template.yaml .agents/skills/personal-learning/scripts/validate-config.sh
git commit -m "refactor: simplify personal learn configuration"
```

### Task 3: Localize and optimize the skill

**Files:**
- Modify: `.agents/skills/personal-learning/SKILL.md`
- Modify: `.agents/skills/personal-learning/references/editorial-policy.md`
- Modify: `.agents/skills/personal-learning/references/markdown-quality.md`
- Modify: `.agents/skills/personal-learning/references/demo-quality.md`
- Modify: `.agents/skills/personal-learning/references/exercise-quality.md`
- Modify: `.agents/skills/personal-learning/evals/evals.json`

- [ ] **Step 1: Localize `SKILL.md`**

Translate the description, headings, workflow, routing, and guardrails into concise Chinese. Preserve `name: personal-learning`, paths, commands, filenames, and level IDs. Remove all configured recommendation language. Keep only one-line option summaries; point formal semantics to `editorial-policy.md`.

- [ ] **Step 2: Localize references**

Translate every natural-language title, table header, policy, checklist, and example explanation. Preserve code, metadata keys, internal IDs, filenames, and technology names. Remove duplicated full level definitions outside `editorial-policy.md`.

- [ ] **Step 3: Update eval expectations**

Change eval 1 to require presenting all four levels and waiting for selection, without recommending expert from profile. Keep six scenarios and valid JSON.

- [ ] **Step 4: Run structure test to verify GREEN**

Run: `sh tests/personal-learning/test-structure.sh`

Expected: PASS with Chinese headings, ordered interaction, unchanged routes, and README boundary intact.

- [ ] **Step 5: Review for consistency**

Search for remaining English prose in skill Markdown, `level_recommendations`, recommendation behavior, mixed terminology, placeholders, and duplicated definitions. Retain English only for declared compatibility identifiers and common technology names.

- [ ] **Step 6: Run full verification**

Run configuration and structure tests, validate live config, syntax-check all shell scripts, parse the six-scenario eval JSON, verify local Markdown links, run `git diff --check`, and require a clean worktree after commit.

- [ ] **Step 7: Commit**

```bash
git add .agents/skills/personal-learning tests/personal-learning
git commit -m "docs: localize and refine personal learn skill"
```
