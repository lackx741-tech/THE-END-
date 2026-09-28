import type { ProjectConfig } from "@/lib/schema";

const sampleAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

export const sampleProject: ProjectConfig = {
  projectName: "Sample ERC20 Control Plane",
  version: "0.1.0",
  chainId: 1,
  rpcUrl: "https://rpc.ankr.com/eth",
  contractAddress: "0x0000000000000000000000000000000000000000",
  rawAbiJson: JSON.stringify(sampleAbi, null, 2),
  selectedFunctions: [
    {
      signature: "name()",
      order: 0,
      customLabel: "Token Name",
      description: "Read token metadata",
      arguments: {},
    },
    {
      signature: "balanceOf(address)",
      order: 1,
      customLabel: "Balance Of",
      description: "Read wallet balance",
      arguments: {
        account: {
          label: "Wallet Address",
          defaultValue: "0x0000000000000000000000000000000000000000",
        },
      },
    },
    {
      signature: "transfer(address,uint256)",
      order: 2,
      customLabel: "Transfer",
      description: "Send tokens",
      arguments: {
        to: { label: "Recipient" },
        amount: { label: "Amount", defaultValue: "1" },
      },
    },
    {
      signature: "mint(uint256)",
      order: 3,
      customLabel: "Mint (payable)",
      description: "Example payable action",
      arguments: {
        amount: { label: "Mint Amount", defaultValue: "1" },
      },
    },
  ],
  ui: {
    theme: "dark",
    layout: "stack",
    walletButtonLabel: "Connect Wallet",
    mountSelector: "#app",
  },
  txStrategy: {
    defaultGasLimit: "0x5208",
    defaultMaxFeePerGas: "0x2540be400",
    defaultMaxPriorityFeePerGas: "0x3b9aca00",
    globalAutomationEnabled: false,
  },
  workflows: [
    {
      name: "read-then-transfer",
      steps: [
        {
          id: "s1",
          signature: "balanceOf(address)",
          mode: "manual",
          condition: "always",
          retryAttempts: 0,
          backoffMs: 0,
          fallback: "abort",
          requiredArguments: ["account"],
        },
        {
          id: "s2",
          signature: "transfer(address,uint256)",
          mode: "manual",
          condition: "previousStepSucceeded",
          retryAttempts: 1,
          backoffMs: 1500,
          fallback: "continueNext",
          requiredArguments: ["to", "amount"],
        },
      ],
    },
  ],
  compilation: {
    compilerVersion: "1.0.0",
    runtimeVersion: "1.0.0",
  },
};
