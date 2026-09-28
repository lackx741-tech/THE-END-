import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
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
  assert.ok(out.script.includes("const widthMatch=param.type.match(/^int"));
  assert.ok(out.script.includes("components.map(c=>value[c.name])"));
});

test("Generated runtime submits write tx with value/fee fields and polls receipt", async () => {
  const compiled = compileProjectDetailed(sampleProject);
  const calls: Array<{ method: string; params?: unknown[] }> = [];
  let receiptChecks = 0;
  const provider = {
    async request({
      method,
      params,
    }: {
      method: string;
      params?: unknown[];
    }): Promise<unknown> {
      calls.push({ method, params });
      if (method === "eth_chainId") return "0x1";
      if (method === "eth_requestAccounts")
        return ["0x0000000000000000000000000000000000000001"];
      if (method === "eth_sendTransaction") return "0xhash";
      if (method === "eth_getTransactionReceipt") {
        receiptChecks += 1;
        return receiptChecks > 1 ? { status: "0x1", transactionHash: "0xhash" } : null;
      }
      throw new Error(`Unexpected method ${method}`);
    },
  };

  const makeElement = () => ({
    className: "",
    textContent: "",
    value: "",
    placeholder: "",
    dataset: {} as Record<string, string>,
    appendChild() {},
    set onclick(_handler: unknown) {},
  });
  const root = { innerHTML: "", appendChild() {} };
  const context: Record<string, unknown> = {
    window: { ethereum: provider, EndTxClient: undefined },
    document: {
      querySelector: () => root,
      body: root,
      head: root,
      getElementById: () => null,
      createElement: () => makeElement(),
    },
    TextEncoder,
    TextDecoder,
    setTimeout: (fn: () => void) => {
      fn();
      return 0;
    },
    clearTimeout: () => {},
  };

  vm.runInNewContext(compiled.script, context);
  const client = (
    context.window as {
      EndTxClient?: { client?: { executeWrite: (...args: unknown[]) => Promise<unknown> } };
    }
  ).EndTxClient?.client;
  assert.ok(client);
  const transferFn = (
    context.window as {
      EndTxClient?: { payload?: { functions?: Array<{ signature: string }> } };
    }
  ).EndTxClient?.payload?.functions?.find((fn) => fn.signature === "transfer(address,uint256)");
  assert.ok(transferFn);

  await client!.executeWrite(
    transferFn,
    ["0x0000000000000000000000000000000000000002", "1"],
    {
      value: "0x1",
      gas: "0x5208",
      maxFeePerGas: "0x2",
      maxPriorityFeePerGas: "0x1",
    },
  );

  const sendTxCall = calls.find((call) => call.method === "eth_sendTransaction");
  assert.ok(sendTxCall);
  const tx = (sendTxCall!.params?.[0] ?? {}) as Record<string, string>;
  assert.equal(tx.value, "0x1");
  assert.equal(tx.gas, "0x5208");
  assert.equal(tx.maxFeePerGas, "0x2");
  assert.equal(tx.maxPriorityFeePerGas, "0x1");
  assert.ok(tx.data.startsWith("0xa9059cbb"));
  assert.ok(receiptChecks >= 2);
});
