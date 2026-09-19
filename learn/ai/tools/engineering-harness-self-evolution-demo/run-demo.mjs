import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  collectCandidate,
  corrections,
  decidePromotion,
  evaluateRule,
  rules
} from "./core.mjs";

export function runDemo({ scenario = "scoped", approve = false } = {}) {
  if (!["none", "blanket", "scoped", "single-signal"].includes(scenario)) {
    throw new Error(`Unknown scenario: ${scenario}`);
  }
  const events = scenario === "single-signal" ? corrections.slice(0, 1) : corrections;
  const ruleName = scenario === "single-signal" ? "scoped" : scenario;
  const candidate = collectCandidate(events, "browser-claim-without-browser-evidence");
  const evaluation = evaluateRule(rules[ruleName]);
  return {
    scenario,
    ruleName,
    candidate,
    evaluation,
    decision: decidePromotion({
      candidate,
      evaluation,
      owner: "delivery-workflow-owner",
      humanApproved: approve
    })
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const scenarioArg = args.find((arg) => arg.startsWith("--scenario="));
  const scenario = scenarioArg?.slice("--scenario=".length) ?? "scoped";
  const approve = args.includes("--approve");
  const unknown = args.filter((arg) => !arg.startsWith("--scenario=") && arg !== "--approve");
  if (unknown.length) {
    console.error(`Unknown arguments: ${unknown.join(", ")}`);
    process.exitCode = 1;
  } else {
    try {
      console.log(JSON.stringify(runDemo({ scenario, approve }), null, 2));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
