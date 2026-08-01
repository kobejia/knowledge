---
name: personal-learn
description: Use when a user asks to learn, understand, explore, document, or practice a topic in this repository, or when creating or substantially revising Markdown learning documents, technical demos, or exercises.
---

# Personal Learn

## Overview

Create source-grounded Markdown at a user-selected depth. Read personal context from repository configuration; keep editorial rules in this skill.

## Required setup

1. Resolve the repository root with `git rev-parse --show-toplevel`.
2. Look for `<repo>/personal-learn-config.yaml`.
3. If missing, tell the user it will be initialized from the bundled default, then run `scripts/init-config.sh <repo>`.
4. Run `scripts/validate-config.sh <repo>/personal-learn-config.yaml`.
5. On failure, report the field error; never use silent defaults or overwrite existing config.
6. Read the config without inferring unlisted experience.

## Required interaction

Complete this sequence before authoring. Skip it only for non-semantic edits.

### 1. Understand

- If topic, scope, or artifact has materially different interpretations, present mutually exclusive options and wait.
- Otherwise describe the understood topic and goal in one or two sentences. Never ask the user to design the outline.

### 2. Ask for a level

Always let the user choose. A configured recommendation is not a selection.

- **专家 (`expert`)**: mechanisms, evolution, trade-offs, production constraints, failures, and frontier questions; skip routine introduction.
- **入门 (`beginner`)**: necessary concepts, basic use, and minimum viable understanding.
- **全面 (`deep-dive`)**: foundations through models, evidence, disagreements, trade-offs, counterexamples, and boundaries.
- **了解 (`survey`)**: a landscape map with necessary introductory context, major parts, value, and key questions; avoid full implementation or exhaustive argument.

### 3. Classify the topic

For a technical topic, ask two separate questions and wait for each answer:

1. Does the user want a Demo?
2. Does the user want exercises?

For non-technical topics, skip both. Never generate either artifact without an affirmative answer.

## Required references

- Always: `references/editorial-policy.md`
- Always: `references/markdown-quality.md`
- Only after Demo is selected: `references/demo-quality.md`
- Only after exercises are selected: `references/exercise-quality.md`

## Authoring workflow

1. Read the target file and adjacent repository context before editing.
2. Verify time-sensitive or professional claims, standards, versions, policies, and disputes with primary or authoritative sources.
3. Choose a natural structure from the selected level and policy; never force a universal outline.
4. Create or revise Markdown. Create a Demo or exercises only when selected.
5. Verify Markdown structure, metadata, links, and citation proximity.
6. Run every Demo; check console output and key behavior, or disclose what is unverified.
7. Ensure exercises are answerable and include answers or grading criteria.
8. Align terminology, assumptions, behavior, and boundaries across all artifacts.
9. Report actual verification; evidence is required for completion claims.

## Guardrails

- README is project introduction, not a knowledge map or manual.
- Never recreate `EDITORIAL_GUIDE.md` or `READER_PROFILE.md`.
- Never infer unconfigured frameworks, languages, industries, projects, opinions, or progress.
- Do not turn a knowledge request into a course, schedule, Demo, or exercise set unless the interaction selected it.
- Preserve existing user edits and avoid unrelated rewrites.
