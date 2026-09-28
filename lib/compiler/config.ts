import { z } from "zod";
import { parseAbi } from "@/lib/compiler/abi";
import type { ProjectConfig, SelectedFunctionConfig } from "@/lib/compiler/types";

const abiEntrySchema = z.object({
  type: z.string(),
}).passthrough();

const selectedFunctionSchema = z.object({
  signature: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int(),
  argumentLabels: z.record(z.string(), z.string()).optional(),
  defaults: z.record(z.string(), z.string()).optional(),
});

const workflowBindingSchema = z.object({
  source: z.enum(["static", "previousResult"]),
  value: z.unknown().optional(),
  path: z.string().optional(),
});

const workflowStepSchema = z.object({
  id: z.string().min(1),
  functionSignature: z.string().min(1),
  label: z.string().min(1),
  retryCount: z.number().int().min(0).max(5).optional(),
  fallback: z.enum(["abort", "continue"]).optional(),
  condition: z.enum(["always", "previous-success"]).optional(),
  argumentBindings: z.record(z.string(), workflowBindingSchema).optional(),
});

const workflowSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(workflowStepSchema).min(1),
});

const configSchema = z.object({
  projectName: z.string().min(1),
  version: z.string().min(1),
  chain: z.object({
    chainId: z.number().int().positive(),
    name: z.string().min(1),
  }),
  contract: z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    abi: z.array(abiEntrySchema),
  }),
  selectedFunctions: z.array(selectedFunctionSchema),
  backendEndpoints: z.object({
    sign: z.string().url(),
    execute: z.string().url(),
    publicConfig: z.string().url().optional(),
  }),
  eip712: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    chainId: z.number().int().positive(),
    verifyingContract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  }),
  workflows: z.array(workflowSchema),
});

export function normalizeSelectedFunctions(items: SelectedFunctionConfig[]) {
  return [...items].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.signature.localeCompare(right.signature);
  });
}

export function validateProjectConfig(config: ProjectConfig) {
  const parsedConfig = configSchema.parse(config);
  const parsedAbi = parseAbi(parsedConfig.contract.abi);
  const signatures = new Set(parsedAbi.map((item) => item.signature));
  const abiMap = new Map(parsedAbi.map((item) => [item.signature, item]));
  const selectedSignatures = new Set(parsedConfig.selectedFunctions.map((item) => item.signature));

  for (const selected of parsedConfig.selectedFunctions) {
    if (!signatures.has(selected.signature)) {
      throw new Error(`Selected function not found in ABI: ${selected.signature}`);
    }
  }

  const seenSelected = new Set<string>();
  for (const selected of parsedConfig.selectedFunctions) {
    if (seenSelected.has(selected.signature)) {
      throw new Error(`Duplicate selected function: ${selected.signature}`);
    }
    seenSelected.add(selected.signature);
  }

  for (const workflow of parsedConfig.workflows) {
    for (const step of workflow.steps) {
      if (!signatures.has(step.functionSignature)) {
        throw new Error(`Workflow step references unknown function: ${step.functionSignature}`);
      }
      if (!selectedSignatures.has(step.functionSignature)) {
        throw new Error(`Workflow step references a function that is not selected: ${step.functionSignature}`);
      }
      const targetFunction = abiMap.get(step.functionSignature);
      const inputNames = new Set(targetFunction?.inputs.map((input) => input.name) ?? []);
      for (const bindingName of Object.keys(step.argumentBindings ?? {})) {
        if (!inputNames.has(bindingName)) {
          throw new Error(
            `Workflow step binding references unknown argument "${bindingName}" for ${step.functionSignature}`,
          );
        }
      }
    }
  }

  return {
    ...parsedConfig,
    selectedFunctions: normalizeSelectedFunctions(parsedConfig.selectedFunctions),
  };
}
