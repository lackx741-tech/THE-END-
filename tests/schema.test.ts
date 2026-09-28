import test from "node:test";
import assert from "node:assert/strict";
import { projectConfigSchema } from "../lib/schema";
import { sampleProject } from "../lib/sample";

test("Project schema validates sample configuration", () => {
  const result = projectConfigSchema.safeParse(sampleProject);
  assert.equal(result.success, true);
});

test("Project schema rejects bad address", () => {
  const bad = { ...sampleProject, contractAddress: "0x123" };
  const result = projectConfigSchema.safeParse(bad);
  assert.equal(result.success, false);
});
