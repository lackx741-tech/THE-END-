import test from "node:test";
import assert from "node:assert/strict";
import { validateWorkflows } from "../lib/workflow";
import { sampleProject } from "../lib/sample";

test("Workflow validator detects unselected function references", () => {
  const config = structuredClone(sampleProject);
  config.workflows[0].steps[0].signature = "doesNotExist()";
  const diagnostics = validateWorkflows(config);
  assert.ok(diagnostics.some((d) => d.level === "error"));
});

test("Workflow validator warns for retry without backoff", () => {
  const config = structuredClone(sampleProject);
  config.workflows[0].steps[1].retryAttempts = 2;
  config.workflows[0].steps[1].backoffMs = 0;
  const diagnostics = validateWorkflows(config);
  assert.ok(diagnostics.some((d) => d.level === "warning"));
});

test("Workflow validator reports missing required arguments", () => {
  const config = structuredClone(sampleProject);
  config.workflows[0].steps[0].requiredArguments = ["missingArg"];
  const diagnostics = validateWorkflows(config);
  assert.ok(diagnostics.some((d) => d.level === "error" && d.message.includes("missing argument")));
});
