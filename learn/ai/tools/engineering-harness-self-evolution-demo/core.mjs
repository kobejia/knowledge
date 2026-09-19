// Synthetic fixtures: these are not records from a real project.
export const deliveryCases = [
  {
    id: "ui-claim-build-only",
    claim: "browser-verified",
    evidence: { build: true, browser: false },
    shouldFlag: true,
    split: "target"
  },
  {
    id: "ui-claim-unit-only",
    claim: "browser-verified",
    evidence: { build: false, browser: false },
    shouldFlag: true,
    split: "holdout"
  },
  {
    id: "build-claim-build-only",
    claim: "build-verified",
    evidence: { build: true, browser: false },
    shouldFlag: false,
    split: "counterexample"
  },
  {
    id: "ui-claim-browser-tested",
    claim: "browser-verified",
    evidence: { build: true, browser: true },
    shouldFlag: false,
    split: "counterexample"
  }
];

export const corrections = [
  {
    taskId: "TASK-101",
    failureKey: "browser-claim-without-browser-evidence",
    sourceRef: "fixture/review/TASK-101#comment-4"
  },
  {
    taskId: "TASK-128",
    failureKey: "browser-claim-without-browser-evidence",
    sourceRef: "fixture/review/TASK-128#comment-2"
  }
];

export const rules = {
  none: () => false,
  blanket: ({ evidence }) => evidence.build && !evidence.browser,
  scoped: ({ claim, evidence }) =>
    claim === "browser-verified" && !evidence.browser
};

export function collectCandidate(events, failureKey) {
  const relevant = events.filter((event) => event.failureKey === failureKey);
  const sourced = relevant.filter((event) => event.taskId && event.sourceRef);
  const distinctTasks = [...new Set(sourced.map((event) => event.taskId))];
  return {
    failureKey,
    observations: relevant.length,
    sourcedObservations: sourced.length,
    independentTasks: distinctTasks.length,
    sourceRefs: sourced.map((event) => event.sourceRef),
    sufficient: distinctTasks.length >= 2
  };
}

export function evaluateRule(rule, cases = deliveryCases) {
  const results = cases.map((item) => {
    const actual = Boolean(rule(item));
    return {
      id: item.id,
      split: item.split,
      expected: item.shouldFlag,
      actual,
      pass: actual === item.shouldFlag
    };
  });
  return {
    results,
    passed: results.filter((item) => item.pass).length,
    total: results.length,
    falsePositives: results.filter((item) => item.actual && !item.expected).map((item) => item.id),
    falseNegatives: results.filter((item) => !item.actual && item.expected).map((item) => item.id)
  };
}

export function decidePromotion({ candidate, evaluation, owner, humanApproved = false }) {
  if (!candidate.sufficient) return "INSUFFICIENT_EVIDENCE";
  if (evaluation.passed !== evaluation.total) return "REJECTED_BY_EVAL";
  if (!owner) return "NEEDS_OWNER";
  if (!humanApproved) return "READY_FOR_HUMAN_REVIEW";
  return "PROMOTED";
}
