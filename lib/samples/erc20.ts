import type { ProjectConfig } from "@/lib/compiler/types";

export const sampleErc20Config: ProjectConfig = {
  projectName: "ERC20 Release Console",
  version: "1.0.0",
  chain: {
    chainId: 1,
    name: "Ethereum",
  },
  contract: {
    address: "0x1111111111111111111111111111111111111111",
    abi: [
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "balance", type: "uint256" }],
      },
      {
        type: "function",
        name: "transfer",
        stateMutability: "nonpayable",
        inputs: [
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "success", type: "bool" }],
      },
      {
        type: "function",
        name: "approve",
        stateMutability: "nonpayable",
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "success", type: "bool" }],
      },
      {
        type: "function",
        name: "airdrop",
        stateMutability: "nonpayable",
        inputs: [
          { name: "recipients", type: "address[]" },
          { name: "amounts", type: "uint256[]" },
        ],
        outputs: [],
      },
      {
        type: "function",
        name: "registerBundle",
        stateMutability: "nonpayable",
        inputs: [
          {
            name: "bundle",
            type: "tuple",
            components: [
              { name: "recipient", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
        ],
        outputs: [],
      },
      {
        type: "function",
        name: "transfer",
        stateMutability: "nonpayable",
        inputs: [
          {
            name: "bundle",
            type: "tuple",
            components: [
              { name: "recipient", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
        ],
        outputs: [{ name: "success", type: "bool" }],
      },
    ],
  },
  selectedFunctions: [
    {
      signature: "balanceOf(address)",
      label: "Check Balance",
      description: "Read balance through backend-verified EIP-712 signing.",
      order: 1,
      argumentLabels: {
        account: "Wallet Address",
      },
    },
    {
      signature: "transfer(address,uint256)",
      label: "Transfer Tokens",
      description: "Create a backend-routed transfer intent.",
      order: 2,
      argumentLabels: {
        recipient: "Recipient",
        amount: "Amount",
      },
      defaults: {
        amount: "1000000000000000000",
      },
    },
    {
      signature: "approve(address,uint256)",
      label: "Approve Spender",
      order: 3,
      argumentLabels: {
        spender: "Spender",
        amount: "Allowance",
      },
    },
    {
      signature: "airdrop(address[],uint256[])",
      label: "Airdrop Batch",
      order: 4,
      argumentLabels: {
        recipients: "Recipients JSON Array",
        amounts: "Amounts JSON Array",
      },
      defaults: {
        recipients: "[\"0x000000000000000000000000000000000000dEaD\"]",
        amounts: "[\"1000000000000000000\"]",
      },
    },
  ],
  backendEndpoints: {
    sign: "https://backend.example.com/sign",
    execute: "https://backend.example.com/execute",
    publicConfig: "https://backend.example.com/config/erc20-release-console",
  },
  eip712: {
    name: "ERC20 Release Console",
    version: "1",
    chainId: 1,
    verifyingContract: "0x1111111111111111111111111111111111111111",
  },
  workflows: [
    {
      id: "approve-then-transfer",
      label: "Approve then Transfer",
      description: "Two-step workflow with retry and fallback configuration.",
      steps: [
        {
          id: "01-approve",
          functionSignature: "approve(address,uint256)",
          label: "Approve",
          retryCount: 1,
          fallback: "abort",
          condition: "always",
          argumentBindings: {
            spender: {
              source: "static",
              value: "0x000000000000000000000000000000000000dEaD",
            },
            amount: {
              source: "static",
              value: "1000000000000000000",
            },
          },
        },
        {
          id: "02-transfer",
          functionSignature: "transfer(address,uint256)",
          label: "Transfer",
          retryCount: 1,
          fallback: "continue",
          condition: "previous-success",
          argumentBindings: {
            recipient: {
              source: "static",
              value: "0x000000000000000000000000000000000000dEaD",
            },
            amount: {
              source: "previousResult",
              path: "result.signResult.approvedAmount",
            },
          },
        },
      ],
    },
  ],
};
