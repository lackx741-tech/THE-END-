import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { compileProjectDetailed } from "../lib/compiler";
import { sampleProject } from "../lib/sample";

type RequestCall = { method: string; params?: unknown[] };

function makeNode() {
  const node: Record<string, unknown> = {
    className: "",
    textContent: "",
    value: "",
    placeholder: "",
    innerHTML: "",
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
    children: [] as unknown[],
    appendChild(child: unknown) {
      (node.children as unknown[]).push(child);
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    onclick: null,
    oninput: null,
    classList: {
      add() {},
      remove() {},
    },
    attachShadow() {
      const shadow = makeNode();
      return shadow;
    },
  };
  return node;
}

function makeRuntimeContext(providerImpl: {
  request: ({ method, params }: { method: string; params?: unknown[] }) => Promise<unknown>;
}) {
  const root = makeNode();
  const documentObj = {
    querySelector: () => root,
    body: root,
    head: root,
    getElementById: () => null,
    createElement: () => makeNode(),
  };

  return {
    context: {
      window: { ethereum: providerImpl, EndTxClient: undefined },
      document: documentObj,
      TextEncoder,
      TextDecoder,
      fetch: async () => ({
        ok: true,
        json: async () => ({ result: "0x" }),
      }),
      setTimeout: (fn: () => void) => {
        fn();
        return 0;
      },
      clearTimeout: () => {},
    } as Record<string, unknown>,
  };
}

test("Compiler output is deterministic for identical config", () => {
  const first = compileProjectDetailed(sampleProject);
  const second = compileProjectDetailed(sampleProject);

  assert.equal(first.diagnostics.filter((d) => d.level === "error").length, 0);
  assert.equal(first.script, second.script);
  assert.equal(first.hash, second.hash);
  assert.ok(!first.script.includes("import "));
  assert.ok(!first.script.includes("require("));
});

test("Compiler embeds signatures and modal design manifest metadata", () => {
  const out = compileProjectDetailed(sampleProject);
  assert.ok(out.script.includes("balanceOf(address)"));
  assert.ok(out.script.includes("window.__PROJECT_CONFIG__"));
  assert.ok(out.script.includes("attachShadow"));
  assert.ok(out.script.includes("forge-modal"));
  assert.ok(out.manifest.modalDesignHash);
  assert.equal(out.manifest.modalDesignSchemaVersion, "1.0");
});

test("Generated runtime submits write tx with value/fee fields and polls receipt", async () => {
  const compiled = compileProjectDetailed(sampleProject);
  const calls: RequestCall[] = [];
  let receiptChecks = 0;
  const provider = {
    async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
      calls.push({ method, params });
      if (method === "eth_chainId") return "0x1";
      if (method === "eth_requestAccounts")
        return ["0x0000000000000000000000000000000000000001"];
      if (method === "eth_sendTransaction") return "0xhash";
      if (method === "eth_getTransactionReceipt") {
        receiptChecks += 1;
        return receiptChecks > 1 ? { status: "0x1", transactionHash: "0xhash" } : null;
      }
      if (method === "eth_call") return "0x";
      throw new Error(`Unexpected method ${method}`);
    },
  };

  const { context } = makeRuntimeContext(provider);
  vm.runInNewContext(compiled.script, context);

  const endTx = (context.window as { EndTxClient?: { client: Record<string, unknown>; payload: Record<string, unknown> } }).EndTxClient;
  assert.ok(endTx?.client);
  const transferFn = (endTx?.payload.functions as Array<{ signature: string }>).find(
    (fn) => fn.signature === "transfer(address,uint256)",
  );
  assert.ok(transferFn);

  await (endTx!.client as { executeWrite: (...args: unknown[]) => Promise<unknown> }).executeWrite(
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

  const calls: RequestCall[] = [];
  const provider = {
    async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
      calls.push({ method, params });
      if (method === "eth_chainId") return "0x1";
      if (method === "eth_requestAccounts")
        return ["0x0000000000000000000000000000000000000001"];
      if (method === "eth_sendTransaction") return "0xhash";
      if (method === "eth_getTransactionReceipt")
        return { status: "0x1", transactionHash: "0xhash" };
      if (method === "eth_call") return "0x";
      throw new Error(`Unexpected method ${method}`);
    },
  };

  const { context } = makeRuntimeContext(provider);
  vm.runInNewContext(compiled.script, context);
  const endTx = (context.window as { EndTxClient?: { client: Record<string, unknown>; payload: Record<string, unknown> } }).EndTxClient;
  const tupleFn = (endTx?.payload.functions as Array<{ signature: string }>).find(
    (fn) => fn.signature === "setPair((address,uint256))",
  );
  assert.ok(endTx?.client && tupleFn);

  await (endTx!.client as { executeWrite: (...args: unknown[]) => Promise<unknown> }).executeWrite(
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
  const calls: RequestCall[] = [];
  const provider = {
    async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
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

  const { context } = makeRuntimeContext(provider);
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
