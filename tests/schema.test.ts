import test from "node:test";
import assert from "node:assert/strict";
import { projectConfigSchema } from "../lib/schema";
import { sampleProject } from "../lib/sample";
import { resolveModalDesign } from "../lib/modal";

test("Project schema validates sample configuration", () => {
  const result = projectConfigSchema.safeParse(sampleProject);
  assert.equal(result.success, true);
});

test("Project schema rejects bad address", () => {
  const bad = { ...sampleProject, contractAddress: "0x123" };
  const result = projectConfigSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test("Modal design defaults are backward-compatible when omitted", () => {
  const legacy = structuredClone(sampleProject);
  delete legacy.ui.modalDesign;
  const parsed = projectConfigSchema.safeParse(legacy);
  assert.equal(parsed.success, true);
  const modal = resolveModalDesign(parsed.success ? parsed.data.ui.modalDesign : undefined);
  assert.equal(modal.layout, "securePanel");
  assert.equal(modal.provider.mode, "auto");
  assert.ok(Array.isArray(modal.provider.order));
});
