# Personal Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the repository homepage into a personal learning hub and add lightweight rules for capturing, generating, validating, and internalizing knowledge.

**Architecture:** `README.md` is the human-facing entry point, `KNOWLEDGE_GUIDE.md` is the durable human/AI writing contract, and `inbox.md` captures unclassified ideas. Existing topic files remain in place and gain only machine-readable maturity metadata.

**Tech Stack:** Markdown, YAML front matter, Git, shell-based document validation

---

### Task 1: Create the Knowledge Hub Homepage

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the placeholder README with the agreed homepage**

Write a concise Chinese README with these exact responsibilities:

```markdown
# Knowledge

> 我的学习领地——由好奇心驱动，借助 AI 探索，最终由实践内化。

这里保存我真正想理解的知识。AI 帮我拓展视野、整理线索和生成初稿；我负责判断、查证、实践，并最终形成自己的理解。

## 学习原则

- **问题先于答案**：先说清楚想解决什么，再收集材料。
- **AI 不是结论**：AI 生成的内容默认只是初稿，关键事实需要查证。
- **实践推动升级**：只有经过运行、比较、复述或实际应用，知识才能进入更高成熟度。
- **保留个人判断**：记录取舍、反例、踩坑和适用边界，而不只整理“正确答案”。
- **持续复习**：已内化不等于永久完成，时效性内容需要定期检查。

## 知识地图

### Vue

- [Vue 状态管理演进：从 Vuex 到 Pinia](vue/vuex-pinia.md)

## 学习看板

| 主题 | 领域 | 成熟度 | 最近更新 | 下一步 |
| --- | --- | --- | --- | --- |
| Vuex 与 Pinia | Vue | 🤖 AI 初稿 | 2026-07-26 | 核验实现细节并运行示例 |

## 想学什么

新的问题先放进 [想法箱](inbox.md)，不必在记录时就决定分类或文章结构。

## 知识如何成熟

`💭 想法` → `🤖 AI 初稿` → `🧪 已验证` → `🧠 已内化`

- **想法**：值得探索，但还没有形成完整材料。
- **AI 初稿**：AI 已协助整理，尚未充分查证或实践。
- **已验证**：关键结论已经过可靠资料或实践验证。
- **已内化**：能够独立解释、应用，并理解其边界和取舍。

详细的写作、查证和状态升级规则见 [知识库协作指南](KNOWLEDGE_GUIDE.md)。
```

- [ ] **Step 2: Verify that every README link resolves**

Run:

```bash
test -f vue/vuex-pinia.md
test -f inbox.md
test -f KNOWLEDGE_GUIDE.md
```

Expected after Tasks 2 and 3: all commands exit with status 0.

### Task 2: Define the Human/AI Knowledge Contract

**Files:**
- Create: `KNOWLEDGE_GUIDE.md`

- [ ] **Step 1: Write the guide**

Create a Chinese guide containing:

1. The purpose: AI expands and drafts; the user decides, verifies, practices, and owns conclusions.
2. The four exact machine states: `idea`, `ai-draft`, `verified`, `internalized`.
3. The required front matter fields: `title`, `status`, `created`, `updated`, `reviewed`.
4. Responsibilities for AI and the user.
5. Natural-writing rules: structure follows the topic; prioritize why, key questions, trade-offs, counterexamples, pitfalls, and boundaries; label uncertainty.
6. Verification rules for sources, runnable technical examples, version-sensitive claims, and maturity upgrades.
7. A section stating that `tech-learning-guide` is a completeness checklist rather than a fixed template.
8. A reusable document skeleton with the exact front matter:

```yaml
---
title: 主题名称
status: ai-draft
created: YYYY-MM-DD
updated: YYYY-MM-DD
reviewed: null
---
```

- [ ] **Step 2: Check guide terminology**

Run:

```bash
rg -n 'idea|ai-draft|verified|internalized|tech-learning-guide' KNOWLEDGE_GUIDE.md
```

Expected: all four state names and the skill name appear.

### Task 3: Add the Idea Inbox

**Files:**
- Create: `inbox.md`

- [ ] **Step 1: Write the lightweight inbox**

Create:

```markdown
# 想法箱

这里记录值得探索、但还没有展开的知识主题。先捕捉问题，不急着分类，也不要求一开始就写成完整文章。

## 使用方式

- 每个想法尽量写成一个问题，而不是只有一个名词。
- 补充“为什么现在想学”，帮助以后判断优先级。
- 开始研究后，为主题创建文档，并把状态更新为 `ai-draft`。
- 已经转化为主题文档的想法从这里移除，由 Git 历史保留记录。

## 待探索

目前没有待探索主题。
```

- [ ] **Step 2: Verify the inbox has no fake example topics**

Run:

```bash
rg -n '^## 待探索$|目前没有待探索主题。' inbox.md
```

Expected: both lines are present.

### Task 4: Add Maturity Metadata Without Rewriting Existing Content

**Files:**
- Modify: `vue/vuex-pinia.md`

- [ ] **Step 1: Save the existing body as a validation baseline**

Run:

```bash
cp vue/vuex-pinia.md /tmp/vuex-pinia-body-before.md
```

Expected: `/tmp/vuex-pinia-body-before.md` contains the current 126-line document.

- [ ] **Step 2: Prepend the agreed YAML front matter**

Add exactly:

```yaml
---
title: Vue 状态管理演进：从 Vuex 到 Pinia
status: ai-draft
created: 2026-07-26
updated: 2026-07-26
reviewed: null
---

```

Do not alter any existing body bytes below the new blank line.

- [ ] **Step 3: Verify that the original body is unchanged**

Run:

```bash
tail -n +9 vue/vuex-pinia.md | cmp - /tmp/vuex-pinia-body-before.md
```

Expected: exit status 0 and no output.

### Task 5: Validate and Commit the Knowledge Base

**Files:**
- Modify: `README.md`
- Create: `KNOWLEDGE_GUIDE.md`
- Create: `inbox.md`
- Modify: `vue/vuex-pinia.md`

- [ ] **Step 1: Scan for unresolved placeholders and Markdown whitespace errors**

Run:

```bash
rg -n 'TODO|TBD|待补充|待定' README.md KNOWLEDGE_GUIDE.md inbox.md vue/vuex-pinia.md
git diff --check
```

Expected: the placeholder scan has no matches; `git diff --check` has no output.

- [ ] **Step 2: Verify required files, metadata, and links**

Run:

```bash
test -f README.md
test -f KNOWLEDGE_GUIDE.md
test -f inbox.md
test -f vue/vuex-pinia.md
rg -n '^status: ai-draft$' vue/vuex-pinia.md
rg -n 'vue/vuex-pinia.md|inbox.md|KNOWLEDGE_GUIDE.md' README.md
```

Expected: all file checks pass, the topic status appears once, and all three README links are found.

- [ ] **Step 3: Review the final diff**

Run:

```bash
git diff -- README.md KNOWLEDGE_GUIDE.md inbox.md vue/vuex-pinia.md
```

Expected: README is replaced, the guide and inbox are added, and the Vue document only gains front matter.

- [ ] **Step 4: Commit the implementation**

Run:

```bash
git add README.md KNOWLEDGE_GUIDE.md inbox.md vue/vuex-pinia.md
git commit -m "docs: establish personal knowledge base"
```

Expected: one commit containing the four intended files.
