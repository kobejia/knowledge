# Editorial Policy

## Core principle

Start from a worthwhile question, build the model needed to answer it, and use details as evidence. A document earns its length through explanation, not coverage theater.

## Four levels

| ID | Name | Required treatment |
| --- | --- | --- |
| `expert` | 专家 | Skip routine setup and API catalogues. Focus on mechanisms, component/data/trust boundaries, evolution, alternatives, performance, security, reliability, maintainability, production failures, and open constraints. |
| `beginner` | 入门 | Establish the minimum vocabulary, mental model, and basic use needed to act. Prefer one coherent path; defer exhaustive alternatives and advanced failure analysis. |
| `deep-dive` | 全面 | Supply only necessary foundations, then examine core models, evidence, major schools or designs, history that explains current constraints, trade-offs, counterexamples, disputes, and real-world boundaries. |
| `survey` | 了解 | Map the field: why it matters, necessary introductory context, major parts, relationships, representative approaches, and the questions worth pursuing next. Do not simulate a deep dive with compressed jargon. |

The selected level controls depth, not a fixed section template or word count.

## Reasoning order

Use this as an internal sequence, not mandatory headings:

```text
core question
  -> key conclusions
  -> system or explanatory model
  -> evolution and design motives
  -> constraints and trade-offs
  -> boundaries, counterexamples, and failure modes
  -> useful cross-domain connections
  -> unresolved questions
```

## Technical topics

At the depth selected by the user, prioritize:

- the root problem and the abstraction introduced to address it;
- runtime model and boundaries between components, processes, threads, data, and trust;
- why the architecture evolved and why older choices remain or were replaced;
- alternatives and the costs of each design decision;
- tensions among performance, security, reliability, and maintainability;
- important production failure modes and conditions where another approach wins;
- connections to more general systems principles and genuinely unresolved constraints.

Examples exist to verify a model, expose a boundary, or compare designs. Do not expand them merely to demonstrate a complete product.

## Non-technical topics

At the depth selected by the user, prioritize:

- the minimum concepts needed to understand the question;
- the main theories, models, or schools and the evidence behind them;
- evidence quality, important disagreements, counterexamples, and practical limits;
- historical, institutional, and social context when it changes the explanation;
- cross-domain connections only when the causal structure really transfers;
- the central insight that follows from the foundations, not a textbook inventory.

## Knowledge status

Keep these categories distinct even when labels are not printed:

- **Fact:** directly supported by a reliable source.
- **Mainstream explanation:** broadly accepted interpretation, not an unchallengeable fact.
- **Inference:** analysis derived from facts, data, or a model.
- **Dispute:** meaningful evidential, theoretical, or value conflict.
- **Unknown:** evidence is insufficient or the subject is still changing.

Never use phrases such as “widely believed” as a substitute for evidence.

## Sources and time sensitivity

- Place citations near the claim they support.
- Make definitions, versions, statistics, policies, standards, quotas, and disputed claims traceable.
- For technical work prefer official documentation, standards, papers, source code, design documents, and maintainer statements.
- For non-technical work prefer original research, authoritative statistics, laws or policy text, classic works, and strong reviews.
- Use secondary sources to discover leads or explain background, not to replace available primary evidence.
- State the verification date, applicable version, or uncertainty for evolving capabilities.
- Keep further reading selective and high-value.

## Structure and voice

- Let complexity determine length and structure. Split a large subject into focused documents rather than forcing a giant guide.
- Explain why a design or theory exists, what it optimizes, what it sacrifices, and where it fails.
- Remove basic repetition that the configured background makes unnecessary, but never omit a reasoning step solely because the reader is experienced.
- Use analogies only when they explain mechanism; state where causal structures differ.
- Use concise, direct language. Remove generic filler and template-shaped paragraphs.

## Prohibitions

- Do not begin with a glossary dump or mechanically enumerate a fixed number of concepts, exercises, projects, or resources.
- Do not present inference, popularity, or analogy as fact.
- Do not describe only usage while hiding design motives and constraints.
- Do not generalize from one successful case or predict trends without reliable support.
- Do not invent the learner's views, history, mastery, conclusions, or progress.
- Do not sacrifice the topic's natural structure for formatting uniformity.

## Editorial completion check

- The core question and actual scope agree.
- The selected level and configured reader starting point are respected.
- Required models, motives, evidence, trade-offs, counterexamples, and boundaries appear at the selected depth.
- Facts, explanations, inferences, disputes, and unknowns are not conflated.
- Important claims have nearby, appropriate sources.
- Basic repetition, filler, and mechanical template prose have been removed.
