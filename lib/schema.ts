import { z } from "zod";

export const uiSettingsSchema = z.object({
  theme: z.enum(["dark", "midnight", "neon"]),
  layout: z.enum(["stack", "grid"]),
  walletButtonLabel: z.string().min(1),
  mountSelector: z.string().min(1).default("#app"),
});

export const txStrategySchema = z.object({
  defaultGasLimit: z.string().optional(),
  defaultMaxFeePerGas: z.string().optional(),
  defaultMaxPriorityFeePerGas: z.string().optional(),
  globalAutomationEnabled: z.boolean().default(false),
});

export const argumentUiSchema = z.object({
  label: z.string().optional(),
  defaultValue: z.string().optional(),
});

export const selectedFunctionSchema = z.object({
  signature: z.string().min(1),
  customLabel: z.string().optional(),
  description: z.string().optional(),
  order: z.number().int().nonnegative(),
  arguments: z.record(z.string(), argumentUiSchema).default({}),
});

export const workflowStepSchema = z.object({
  id: z.string().min(1),
  signature: z.string().min(1),
  mode: z.enum(["manual", "automatic"]),
  condition: z.enum(["always", "previousStepSucceeded", "previousStepFailed"]),
  retryAttempts: z.number().int().min(0).max(10).default(0),
  backoffMs: z.number().int().min(0).max(60000).default(0),
  fallback: z.enum(["abort", "continueNext"]),
  requiredArguments: z.array(z.string()).default([]),
});

export const workflowSchema = z.object({
  name: z.string().min(1),
  steps: z.array(workflowStepSchema).default([]),
});

export const compilationMetaSchema = z.object({
  compilerVersion: z.string().default("1.0.0"),
  runtimeVersion: z.string().default("1.0.0"),
});

export const projectConfigSchema = z.object({
  projectName: z.string().min(1),
  version: z.string().min(1),
  chainId: z.union([
    z.number().int().positive(),
    z.string().regex(/^[1-9][0-9]*$/, "Chain ID must be a positive integer string"),
  ]),
  rpcUrl: z.string().url(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid contract address"),
  rawAbiJson: z.string().min(2),
  selectedFunctions: z.array(selectedFunctionSchema),
  ui: uiSettingsSchema,
  txStrategy: txStrategySchema,
  workflows: z.array(workflowSchema),
  compilation: compilationMetaSchema,
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type SelectedFunctionConfig = z.infer<typeof selectedFunctionSchema>;
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
