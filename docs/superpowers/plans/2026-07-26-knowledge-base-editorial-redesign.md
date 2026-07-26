# Knowledge Base Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the learning-progress system with a reader-aware editorial system for generating deep, evidence-backed knowledge documents.

**Architecture:** `README.md` is a minimal public knowledge map, `READER_PROFILE.md` supplies stable reader context and depth defaults, and `EDITORIAL_GUIDE.md` defines research and writing quality. Topic documents carry only domain and depth metadata; obsolete learning-management and internal process files are removed from the final tree.

**Tech Stack:** Markdown, YAML front matter, Git, shell-based content validation

---

### Task 1: Replace the Homepage

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README with the minimal knowledge map**

Use:

```markdown
# Knowledge

一个由 AI 协助研究和撰写的深度知识库。

这里不追求教程数量和知识点覆盖率，而是围绕重要问题，理解其核心模型、演化过程、约束、取舍与边界。

## 内容原则

- 从关键问题出发，不从术语清单出发
- 优先解释设计动因和系统关系
- 区分事实、推论、主流观点与争议
- 关注反例、失败模式和适用边界
- 通过跨领域连接扩展认知视野
- 关键事实就近引用可靠来源
- 篇幅服从问题复杂度，不套固定模板

## 知识地图

### 技术

#### Vue

- [Vue 状态管理演进：从 Vuex 到 Pinia](vue/vuex-pinia.md)

## 编辑规范

文档生成和研究标准见 [编辑指南](EDITORIAL_GUIDE.md)，默认深度由 [读者画像](READER_PROFILE.md) 决定。
```

- [ ] **Step 2: Verify README has no learning-management sections**

Run:

```bash
if rg -n '学习看板|知识如何成熟|想法箱|AI 初稿|已内化' README.md; then exit 1; fi
```

Expected: no matches and exit status 0.

### Task 2: Add the Reader Profile and Depth System

**Files:**
- Create: `READER_PROFILE.md`

- [ ] **Step 1: Write the explicit reader profile**

Create:

```markdown
# 读者画像

这份文件为 AI 提供稳定的读者上下文，用于调整知识文档的起点、深度和关注重点。这里只记录用户明确提供的信息，不根据职业年限猜测具体技术栈或项目经历。

## 目标

通过高质量知识文档持续扩展视野、增加知识深度，并强化分析复杂系统的能力。

## 职业背景

- 10 年前端开发经验
- 前端相关主题不需要重复常规入门知识
- 更关注核心模型、运行机制、架构演化、设计取舍和生产边界

## 领域策略

### 前端与相关 Web 工程

默认跳过基础 API 教程，聚焦底层运行模型、架构与组件边界、设计演化、方案取舍、性能、安全、生产约束和未来方向。

### 相邻技术领域

根据必要前置知识选择 `deep-dive` 或 `expert`。只补足理解核心模型所需的基础，不从通用编程概念重新讲起。

### 非技术及陌生领域

从必要基础开始，逐步进入核心理论、主要学派、证据、争议、反例、现实边界和跨领域联系，目标是抵达精髓而不是停留在科普。

## 文档深度

| 等级 | 名称 | 适用场景 | 写作方式 |
| --- | --- | --- | --- |
| `survey` | 视野地图 | 快速认识一个新主题 | 建立概念地图、价值和关键问题，不深入实现细节 |
| `deep-dive` | 从基础到精髓 | 不熟悉或跨领域主题的默认值 | 只补必要基础，逐步进入核心模型、证据、争议和边界 |
| `expert` | 架构与高阶 | 前端及已有经验的领域 | 跳过常规入门，聚焦内部机制、架构取舍、生产约束和前沿问题 |

## 默认规则

- 前端、浏览器、JavaScript 和 Web 工程使用 `expert`
- 相邻技术领域由 AI 判断使用 `deep-dive` 或 `expert`
- 非技术及陌生领域使用 `deep-dive`
- 只有明确要求“快速了解”时使用 `survey`
- 用户指定的深度优先于默认规则

## 边界

- 不虚构用户掌握的框架、语言、行业或项目经历
- 不用“资深开发者”作为省略关键推理步骤的理由
- 不把前端经验自动等同于后端、基础设施、AI 或非技术领域经验
- 当主题和默认深度存在实质歧义时再向用户确认
```

- [ ] **Step 2: Verify all depth levels and explicit experience are present**

Run:

```bash
for term in survey deep-dive expert '10 年前端开发经验'; do rg -q "$term" READER_PROFILE.md; done
```

Expected: exit status 0.

### Task 3: Replace the Learning Guide with an Editorial Guide

**Files:**
- Create: `EDITORIAL_GUIDE.md`
- Delete: `KNOWLEDGE_GUIDE.md`

- [ ] **Step 1: Write the editorial guide**

The guide must contain these exact top-level sections:

```markdown
# 编辑指南

## 生成前
## 共同原则
## 技术主题
## 非技术主题
## 事实、解释与争议
## 推理顺序
## 引用与时效性
## 文档元信息
## 生成流程
## 禁止事项
## 发布前检查
```

Under those sections, encode the following rules:

- Read `READER_PROFILE.md` before choosing the starting point and depth.
- Define the core question, domain, depth, relevant reader context, and time-sensitive claims before writing.
- Technical documents prioritize the problem, runtime model, boundaries, evolution, trade-offs, production failures, cross-system connections, and open questions.
- Non-technical documents prioritize necessary foundations, models, schools, evidence, disagreements, counterexamples, historical context, cross-domain connections, and final insights.
- Distinguish fact, mainstream interpretation, inference, controversy, and unknown.
- Put citations next to version-sensitive, quantitative, definitional, policy, and disputed claims.
- Prefer official documentation, standards, papers, source code, and primary records.
- Use adaptive structure and length.
- Use minimal front matter with `title`, `domain`, `depth`, `created`, and `updated`.
- Never fabricate user voice, experience, conclusions, or reading progress.
- Never default to courses, schedules, project counts, exercises, or fixed article templates.

- [ ] **Step 2: Remove the obsolete learning guide**

Delete `KNOWLEDGE_GUIDE.md`.

- [ ] **Step 3: Verify editorial coverage**

Run:

```bash
for term in '技术主题' '非技术主题' '事实、解释与争议' '引用与时效性' 'READER_PROFILE.md' 'survey' 'deep-dive' 'expert'; do rg -q "$term" EDITORIAL_GUIDE.md; done
```

Expected: exit status 0.

### Task 4: Simplify Existing Topic Metadata

**Files:**
- Modify: `vue/vuex-pinia.md`

- [ ] **Step 1: Confirm the existing body boundary**

Run:

```bash
git show HEAD:vue/vuex-pinia.md | sed -n '1,10p'
```

Expected: the current seven-line front matter is followed by a blank line and the article heading on line 9.

- [ ] **Step 2: Replace the front matter**

Use:

```yaml
---
title: Vue 状态管理演进：从 Vuex 到 Pinia
domain: frontend
depth: expert
created: 2026-02-28
updated: 2026-07-26
---
```

- [ ] **Step 3: Verify body text is unchanged**

Run:

```bash
diff -u \
  <(git show HEAD:vue/vuex-pinia.md | tail -n +9 | LC_ALL=C perl -0777 -pe 's/\r\n/\n/g; s/\n?\z/\n/') \
  <(tail -n +8 vue/vuex-pinia.md | LC_ALL=C perl -0777 -pe 's/\r\n/\n/g; s/\n?\z/\n/')
```

Expected: exit status 0 and no output.

### Task 5: Remove Obsolete Learning and Process Files

**Files:**
- Delete: `inbox.md`
- Delete: `docs/superpowers/`

- [ ] **Step 1: Delete the idea inbox**

Remove `inbox.md`; topic discovery happens through user requests rather than a maintained learning queue.

- [ ] **Step 2: Delete internal design and implementation documents**

Remove `docs/superpowers/`, including this plan, after all preceding task instructions have been loaded. Git history retains every deleted file.

- [ ] **Step 3: Verify the obsolete system is absent**

Run:

```bash
test ! -e KNOWLEDGE_GUIDE.md
test ! -e inbox.md
test ! -e docs/superpowers
```

Expected: exit status 0.

### Task 6: Validate and Commit the Redesign

**Files:**
- Modify: `README.md`
- Create: `READER_PROFILE.md`
- Create: `EDITORIAL_GUIDE.md`
- Modify: `vue/vuex-pinia.md`
- Delete: `KNOWLEDGE_GUIDE.md`
- Delete: `inbox.md`
- Delete: `docs/superpowers/`

- [ ] **Step 1: Verify required files and links**

Run:

```bash
set -e
test -f README.md
test -f READER_PROFILE.md
test -f EDITORIAL_GUIDE.md
test -f vue/vuex-pinia.md
rg -q 'vue/vuex-pinia.md' README.md
rg -q 'EDITORIAL_GUIDE.md' README.md
rg -q 'READER_PROFILE.md' README.md
```

Expected: exit status 0.

- [ ] **Step 2: Verify obsolete concepts and files are gone**

Run:

```bash
set -e
test ! -e KNOWLEDGE_GUIDE.md
test ! -e inbox.md
test ! -e docs/superpowers
if rg -n 'AI 初稿|已内化|学习看板|想法箱' README.md READER_PROFILE.md EDITORIAL_GUIDE.md; then exit 1; fi
```

Expected: exit status 0.

- [ ] **Step 3: Verify metadata and Markdown quality**

Run:

```bash
set -e
rg -q '^domain: frontend$' vue/vuex-pinia.md
rg -q '^depth: expert$' vue/vuex-pinia.md
if rg -n 'TODO|TBD|待补充|待定' README.md READER_PROFILE.md EDITORIAL_GUIDE.md vue/vuex-pinia.md; then exit 1; fi
git diff --check
```

Expected: exit status 0 and no whitespace errors.

- [ ] **Step 4: Review and commit**

Run:

```bash
git status --short
git diff --stat
git diff
git add -A
git diff --cached --check
git commit -m "docs: refocus knowledge base on deep research"
git push
```

Expected: the final commit contains only the reader-aware editorial system and existing topic content; PR #1 updates successfully.
