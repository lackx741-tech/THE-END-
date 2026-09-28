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

test("Generated runtime contains signed-int and named-tuple handling", () => {
  const tupleProject = structuredClone(sampleProject);
  tupleProject.rawAbiJson = JSON.stringify(
    [
      {
        type: "function",
        name: "getDelta",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "delta", type: "int256" }],
      },
      {
        type: "function",
        name: "setPair",
        stateMutability: "nonpayable",
        inputs: [
          {
            name: "pair",
            type: "tuple",
            components: [
              { name: "owner", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
        ],
        outputs: [],
      },
    ],
    null,
    2,
  );
  tupleProject.selectedFunctions = [
    { signature: "getDelta()", order: 0, customLabel: "delta", description: "", arguments: {} },
    {
      signature: "setPair((address,uint256))",
      order: 1,
      customLabel: "set pair",
      description: "",
      arguments: {},
    },
  ];
  tupleProject.workflows = [];
  const out = compileProjectDetailed(tupleProject);
  assert.equal(out.diagnostics.filter((d) => d.level === "error").length, 0);
  assert.ok(out.script.includes("value=hexToBigInt(word);const limit=1n<<255n"));
  assert.ok(out.script.includes("components.map(c=>value[c.name])"));
});
