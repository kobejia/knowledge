import assert from "node:assert/strict";
import {
  collectCandidate,
  corrections,
  decidePromotion,
  evaluateRule,
  rules
} from "./core.mjs";
import { runDemo } from "./run-demo.mjs";

const baseline = runDemo({ scenario: "none" });
assert.deepEqual(baseline.evaluation.falseNegatives, [
  "ui-claim-build-only",
  "ui-claim-unit-only"
]);

const broad = runDemo({ scenario: "blanket" });
assert.deepEqual(broad.evaluation.falsePositives, ["build-claim-build-only"]);
assert.deepEqual(broad.evaluation.falseNegatives, ["ui-claim-unit-only"]);
assert.equal(broad.decision, "REJECTED_BY_EVAL");

const scoped = runDemo();
assert.equal(scoped.candidate.independentTasks, 2);
assert.equal(scoped.evaluation.passed, scoped.evaluation.total);
assert.equal(scoped.decision, "READY_FOR_HUMAN_REVIEW");
assert.equal(runDemo({ approve: true }).decision, "PROMOTED");
assert.equal(runDemo({ scenario: "single-signal", approve: true }).decision, "INSUFFICIENT_EVIDENCE");

const duplicate = collectCandidate([corrections[0], corrections[0]], corrections[0].failureKey);
assert.equal(duplicate.independentTasks, 1);
assert.equal(duplicate.sufficient, false);

const unsourced = collectCandidate(
  [{ ...corrections[0], sourceRef: "" }, corrections[1]],
  corrections[0].failureKey
);
assert.equal(unsourced.independentTasks, 1);

const missingOwner = decidePromotion({
  candidate: scoped.candidate,
  evaluation: evaluateRule(rules.scoped),
  owner: "",
  humanApproved: true
});
assert.equal(missingOwner, "NEEDS_OWNER");

console.log(JSON.stringify({
  status: "PASS",
  checks: [
    "baseline misses both browser-evidence failures",
    "broad rule fails a counterexample and a holdout",
    "scoped rule passes target, holdout, and counterexamples",
    "promotion requires distinct sourced tasks, passing evals, an owner, and human review"
  ]
}, null, 2));
