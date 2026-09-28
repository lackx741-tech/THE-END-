import test from "node:test";
import assert from "node:assert/strict";
import { parseAndNormalizeAbi } from "../lib/abi";

test("ABI parser normalizes overloaded signatures and tuple arrays", () => {
  const abi = [
    {
      type: "function",
      name: "foo",
      stateMutability: "view",
      inputs: [{ name: "a", type: "uint256" }],
      outputs: [{ type: "uint256" }],
    },
    {
      type: "function",
      name: "foo",
      stateMutability: "nonpayable",
      inputs: [{ name: "a", type: "address" }],
      outputs: [],
    },
    {
      type: "function",
      name: "bar",
      stateMutability: "payable",
      inputs: [
        {
          name: "item",
          type: "tuple[]",
          components: [
            { name: "owner", type: "address" },
            { name: "value", type: "uint256" },
          ],
        },
      ],
      outputs: [],
    },
  ];

  const out = parseAndNormalizeAbi(JSON.stringify(abi));
  assert.equal(out.errors.length, 0);
  assert.equal(out.functions.length, 3);
  assert.ok(out.functions.some((fn) => fn.signature === "foo(uint256)"));
  assert.ok(out.functions.some((fn) => fn.signature === "foo(address)"));
  assert.ok(out.functions.some((fn) => fn.signature === "bar((address,uint256)[])"));
});

test("ABI parser reports malformed entries", () => {
  const bad = [{ type: "function", name: "x", inputs: [{ type: "tuple" }] }];
  const out = parseAndNormalizeAbi(JSON.stringify(bad));
  assert.equal(out.functions.length, 0);
  assert.ok(out.errors[0].includes("Tuple parameter"));
});

test("ABI parser computes Ethereum keccak selector hints", () => {
  const abi = [
    {
      type: "function",
      name: "transfer",
      stateMutability: "nonpayable",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ type: "bool" }],
    },
  ];
  const out = parseAndNormalizeAbi(JSON.stringify(abi));
  assert.equal(out.errors.length, 0);
  assert.equal(out.functions[0].canonicalSelectorHint, "0xa9059cbb");
});
