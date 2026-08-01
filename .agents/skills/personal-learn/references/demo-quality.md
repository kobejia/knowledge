# Demo Quality

Load this reference only after the user selects a Demo for a technical topic.

## Purpose and scope

- State the exact concept, runtime behavior, boundary, counterexample, or trade-off the Demo verifies.
- Build the smallest observable example that serves that purpose.
- Prefer plain HTML, CSS, and JavaScript unless a framework or dependency is itself part of the subject.
- Exclude decorative features, unrelated abstractions, analytics, authentication, and production scaffolding.

## Organization

- Keep HTML responsible for semantics, CSS for presentation, and JavaScript for behavior.
- Use names that match the document's terminology.
- Add brief comments only where the reason is not evident from the code.
- Keep setup instructions beside the Demo when opening the HTML file is insufficient.

## Verification

- Start or open the Demo using the documented path.
- Check the initial state, each key interaction, expected state transitions, and failure or boundary cases described by the document.
- Inspect the browser console for errors and warnings caused by the Demo.
- Check narrow and wide viewports when layout affects the claim.
- Verify the document does not promise behavior the code lacks.

## Completion check

- The Demo has one explicit learning or verification goal.
- It runs with the documented steps and has no unexplained console error.
- Key interactions and relevant viewports were actually checked.
- Code, prose, terminology, assumptions, and limitations agree.
- Any unverified environment or behavior is disclosed rather than reported as complete.
