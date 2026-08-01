# Personal Learn Practice Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace independent Demo and exercise choices with one optional practice artifact that always combines a verified Demo and Demo-driven exercises.

**Architecture:** `SKILL.md` asks one practice question for technical topics and routes one selected branch to `practice-quality.md`. The new reference unifies goal, Demo construction, exercise design, answers, and verification; old references and single-artifact eval branches are removed.

**Tech Stack:** Markdown, JSON, POSIX shell, Git

---

### Task 1: Define the failing practice contract

**Files:**
- Modify: `tests/personal-learn/test-structure.sh`

- [ ] **Step 1: Replace old reference expectations**

Require `references/practice-quality.md`. Assert `references/demo-quality.md` and `references/exercise-quality.md` are absent. Keep editorial and Markdown references required.

- [ ] **Step 2: Assert one combined interaction**

Require `SKILL.md` to ask once whether the user needs “配套实践”, describe it as “可运行 Demo + 配套练习题”, route only to `references/practice-quality.md`, and contain no separate “是否需要 Demo” or “是否需要练习题” questions.

- [ ] **Step 3: Run the structure test to verify RED**

Run: `sh tests/personal-learn/test-structure.sh`

Expected: FAIL because `practice-quality.md` is missing and old reference files remain.

- [ ] **Step 4: Commit failing test**

```bash
git add tests/personal-learn/test-structure.sh
git commit -m "test: define combined practice workflow"
```

### Task 2: Implement the combined practice workflow

**Files:**
- Modify: `.agents/skills/personal-learn/SKILL.md`
- Create: `.agents/skills/personal-learn/references/practice-quality.md`
- Delete: `.agents/skills/personal-learn/references/demo-quality.md`
- Delete: `.agents/skills/personal-learn/references/exercise-quality.md`

- [ ] **Step 1: Replace the interaction**

For technical topics ask once: “是否需要配套实践（可运行 Demo + 配套练习题）？” For non-technical topics skip the question. If a request asks for only one half, explain the combined boundary and ask whether to create the complete practice.

- [ ] **Step 2: Replace routing and authoring steps**

Always load editorial and Markdown references. Load `practice-quality.md` only after practice is selected. Generate neither artifact when practice is declined, and always generate both when selected.

- [ ] **Step 3: Write the unified practice reference**

Organize it as: practice goal, Demo construction, exercise tasks, answers, verification loop, and completion check. Require the loop “运行 → 观察 → 推理 → 修改 → 验证”, one main learning goal, level-matched exercises, actual Demo execution, and disclosure of unverified behavior.

- [ ] **Step 4: Delete obsolete references**

Remove both old reference files after all effective rules have a destination in `practice-quality.md`.

- [ ] **Step 5: Run structure test to verify GREEN**

Run: `sh tests/personal-learn/test-structure.sh`

Expected: PASS with one practice route and no obsolete files.

- [ ] **Step 6: Commit**

```bash
git add .agents/skills/personal-learn tests/personal-learn/test-structure.sh
git commit -m "refactor: combine personal learn practice artifacts"
```

### Task 3: Update evals and verify

**Files:**
- Modify: `.agents/skills/personal-learn/evals/evals.json`

- [ ] **Step 1: Update the six eval scenarios**

Replace independent Demo/exercise expectations with: one practice question, complete practice selected, no practice selected, Demo-only request boundary, exercise-only request boundary, and non-technical skip. Preserve six total scenarios and valid JSON.

- [ ] **Step 2: Scan for obsolete branches**

Search live skill files for `demo-quality.md`, `exercise-quality.md`, separate “是否需要 Demo/练习题” questions, and language allowing only one artifact. No live matches may remain.

- [ ] **Step 3: Run full verification**

Run configuration and structure tests, validate live config, syntax-check shell scripts, parse six eval scenarios, verify local Markdown links, run `git diff --check`, and require a clean worktree after commit.

- [ ] **Step 4: Commit**

```bash
git add .agents/skills/personal-learn/evals/evals.json
git commit -m "test: update personal learn practice scenarios"
```
