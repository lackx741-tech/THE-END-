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

test("Generated runtime encodes tuple object arguments for write calls", async () => {
  const tupleProject = structuredClone(sampleProject);
  tupleProject.rawAbiJson = JSON.stringify(
    [
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
    {
      signature: "setPair((address,uint256))",
      order: 0,
      customLabel: "setPair",
      description: "",
      arguments: {},
    },
  ];
  tupleProject.workflows = [];
  const compiled = compileProjectDetailed(tupleProject);
  const calls: Array<{ method: string; params?: unknown[] }> = [];
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
      if (method === "eth_getTransactionReceipt")
        return { status: "0x1", transactionHash: "0xhash" };
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
  const tupleFn = (
    context.window as {
      EndTxClient?: { payload?: { functions?: Array<{ signature: string }> } };
    }
  ).EndTxClient?.payload?.functions?.find(
    (fn) => fn.signature === "setPair((address,uint256))",
  );
  assert.ok(client && tupleFn);

  await client!.executeWrite(
    tupleFn,
    [{ owner: "0x0000000000000000000000000000000000000003", amount: "7" }],
    {},
  );

  const sendTxCall = calls.find((call) => call.method === "eth_sendTransaction");
  assert.ok(sendTxCall);
  const data = ((sendTxCall!.params?.[0] as Record<string, string>).data ?? "").toLowerCase();
  assert.ok(data.includes("0000000000000000000000000000000000000000000000000000000000000007"));
  assert.ok(data.includes("0000000000000000000000000000000000000003"));
});

test("Workflow runtime respects abort vs continueNext fallback", async () => {
  const project = structuredClone(sampleProject);
  project.rawAbiJson = JSON.stringify(
    [
      {
        type: "function",
        name: "ping",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
      },
      {
        type: "function",
        name: "bump",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: [],
      },
    ],
    null,
    2,
  );
  project.selectedFunctions = [
    { signature: "ping()", order: 0, customLabel: "ping", description: "", arguments: {} },
    { signature: "bump()", order: 1, customLabel: "bump", description: "", arguments: {} },
  ];
  project.workflows = [
    {
      name: "abort-flow",
      steps: [
        {
          id: "a1",
          signature: "ping()",
          mode: "manual",
          condition: "always",
          retryAttempts: 0,
          backoffMs: 0,
          fallback: "abort",
          requiredArguments: [],
        },
        {
          id: "a2",
          signature: "bump()",
          mode: "manual",
          condition: "always",
          retryAttempts: 0,
          backoffMs: 0,
          fallback: "abort",
          requiredArguments: [],
        },
      ],
    },
    {
      name: "continue-flow",
      steps: [
        {
          id: "c1",
          signature: "ping()",
          mode: "manual",
          condition: "always",
          retryAttempts: 0,
          backoffMs: 0,
          fallback: "continueNext",
          requiredArguments: [],
        },
        {
          id: "c2",
          signature: "bump()",
          mode: "manual",
          condition: "always",
          retryAttempts: 0,
          backoffMs: 0,
          fallback: "abort",
          requiredArguments: [],
        },
      ],
    },
  ];

  const compiled = compileProjectDetailed(project);
  const calls: Array<{ method: string; params?: unknown[] }> = [];
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
      if (method === "eth_call") throw new Error("forced ping failure");
      if (method === "eth_sendTransaction") return "0xhash";
      if (method === "eth_getTransactionReceipt")
        return { status: "0x1", transactionHash: "0xhash" };
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
    fetch: async () => {
      throw new Error("fetch should not be used when provider exists");
    },
    setTimeout: (fn: () => void) => {
      fn();
      return 0;
    },
    clearTimeout: () => {},
  };
  vm.runInNewContext(compiled.script, context);
  const client = (
    context.window as {
      EndTxClient?: {
        client?: { executeWorkflow: (name: string, args: Record<string, unknown>) => Promise<unknown> };
      };
    }
  ).EndTxClient?.client;
  assert.ok(client);

  calls.length = 0;
  await client!.executeWorkflow("abort-flow", {});
  const abortSends = calls.filter((call) => call.method === "eth_sendTransaction").length;
  assert.equal(abortSends, 0);

  calls.length = 0;
  await client!.executeWorkflow("continue-flow", {});
  const continueSends = calls.filter((call) => call.method === "eth_sendTransaction").length;
  assert.equal(continueSends, 1);
});
