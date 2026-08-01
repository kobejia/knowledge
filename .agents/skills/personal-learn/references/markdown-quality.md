# Markdown Quality

## Metadata

Formal learning documents use minimal YAML frontmatter:

```yaml
---
title: 文档标题
domain: frontend
depth: expert
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

- `depth` is one of `beginner`, `survey`, `deep-dive`, or `expert`.
- Preserve `created`; change `updated` only for a substantive revision.
- `domain` is a practical field label, not a demand for a complete taxonomy.
- README and lightweight catalogues may omit frontmatter when metadata adds no retrieval value.
- Do not add learning progress, mastery, generation stage, or invented personal state.

## Structure

- Use one H1 title. Nest subsequent headings without skipping levels.
- Choose headings that express the document's argument, not a universal template.
- Use paragraphs for reasoning, lists for parallel items, and tables only for repeated-field comparisons.
- Fence code with the correct language and keep examples minimal enough to inspect.
- Define abbreviations on first use unless the configured reader can safely be expected to know them.

## Links and citations

- Prefer relative paths for repository files and verify every changed internal link.
- Put a source immediately after the claim or paragraph it supports.
- Use descriptive link text rather than bare URLs or “click here.”
- Do not add document links or a knowledge map to README.

## Completion check

- Frontmatter, dates, and selected depth are valid where applicable.
- Heading hierarchy, fences, lists, and tables render correctly.
- Internal links resolve and external sources support the adjacent claims.
- No trailing whitespace, placeholder text, dead anchors, or unexplained empty sections remain.
- `git diff --check` passes.
