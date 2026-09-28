import test from "node:test";
import assert from "node:assert/strict";
import { compileProjectDetailed } from "../lib/compiler";
import { sampleProject } from "../lib/sample";

test("Compiler output is deterministic for identical config", () => {
  const first = compileProjectDetailed(sampleProject);
  const second = compileProjectDetailed(sampleProject);

  assert.equal(first.diagnostics.filter((d) => d.level === "error").length, 0);
  assert.equal(first.script, second.script);
  assert.equal(first.hash, second.hash);
  assert.ok(!first.script.includes("import "));
  assert.ok(!first.script.includes("require("));
});

test("Compiler embeds selected function signatures", () => {
  const out = compileProjectDetailed(sampleProject);
  assert.ok(out.script.includes("balanceOf(address)"));
  assert.ok(out.script.includes("transfer(address,uint256)"));
});
