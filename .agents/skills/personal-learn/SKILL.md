---
name: personal-learn
description: Use when creating or substantially revising learning documents, knowledge articles, Markdown explanations, technical demos, or exercises in this repository.
---

# Personal Learn

## Overview

Turn a learning request into a source-grounded Markdown document whose depth matches an explicit user choice. Personal context comes from repository configuration; editorial quality comes from this skill.

## Required setup

Before discussing document structure:

1. Resolve the repository root with `git rev-parse --show-toplevel`.
2. Look for `<repo>/personal-learn-config.yaml`.
3. If missing, tell the user it will be initialized from the bundled default, then run `scripts/init-config.sh <repo>`.
4. Run `scripts/validate-config.sh <repo>/personal-learn-config.yaml`.
5. Stop on validation failure. Report the field error; do not silently use defaults or rewrite an existing config.
6. Read the validated config. Treat its background as explicit context, never as permission to invent experience.

## Required interaction

Do not generate the document before completing this sequence. Skip it only for spelling, mechanical formatting, or another edit that does not change meaning.

### 1. Understand

- If topic, scope, or intended artifact has multiple materially different interpretations, present concise mutually exclusive options and wait.
- Otherwise introduce your understanding of the topic and goal in one or two sentences. Do not ask the user to design the outline.

### 2. Ask for a level

Always let the user choose. You may recommend one level from the config, but a recommendation is not a selection.

- **专家 (`expert`)**: mechanisms, architecture evolution, trade-offs, production constraints, failure modes, and frontier questions; skip routine introduction.
- **入门 (`beginner`)**: necessary concepts, basic use, and minimum viable understanding.
- **全面 (`deep-dive`)**: necessary foundations through models, evidence, disagreements, trade-offs, counterexamples, and real-world boundaries.
- **了解 (`survey`)**: a landscape map with necessary introductory context, major parts, value, and key questions; avoid full implementation or exhaustive argument.

Wait for the level choice before continuing.

### 3. Classify the topic

For a technical topic, ask two separate questions and wait for each answer:

1. Does the user want a Demo?
2. Does the user want exercises?

For a non-technical topic, skip both questions. Do not generate either artifact without an affirmative answer.

## Required references

Read these files completely before authoring:

- Always: `references/editorial-policy.md`
- Always: `references/markdown-quality.md`
- Only after Demo is selected: `references/demo-quality.md`
- Only after exercises are selected: `references/exercise-quality.md`

Resolve reference paths relative to this `SKILL.md`.

## Authoring workflow

1. Read the target file and adjacent repository context before editing.
2. Research time-sensitive facts, professional claims, standards, versions, policies, and disputes from primary or authoritative sources.
3. Choose the document's natural structure from the selected level and editorial policy. Do not force a universal outline.
4. Create or revise Markdown. Create a Demo or exercises only when selected.
5. Verify Markdown structure, metadata, links, and citation proximity.
6. Run or open every Demo and check console output and key behavior. If that is impossible, say what remains unverified.
7. Check that exercises are answerable from the document and that answers or grading criteria are present.
8. Compare terminology, assumptions, behavior, and boundaries across the document, Demo, and exercises.
9. Report the actual verification performed. Evidence is required before claiming completion.

## Guardrails

- README is project introduction, not a knowledge map or editorial manual.
- Do not recreate `EDITORIAL_GUIDE.md` or `READER_PROFILE.md`; their durable content lives in this skill and the root config.
- Do not infer frameworks, languages, industries, projects, opinions, or learning progress absent from config or user input.
- Do not turn a knowledge request into a course, schedule, Demo, or exercise set unless the interaction selected it.
- Preserve existing user edits and avoid unrelated rewrites.
