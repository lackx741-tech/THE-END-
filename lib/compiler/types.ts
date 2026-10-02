export type AbiStateMutability = "pure" | "view" | "nonpayable" | "payable";

export interface AbiParameter {
  name?: string;
  type: string;
  internalType?: string;
  components?: AbiParameter[];
}

export interface AbiFunctionEntry {
  type: "function";
  name: string;
  stateMutability?: AbiStateMutability;
  constant?: boolean;
  payable?: boolean;
  inputs?: AbiParameter[];
  outputs?: AbiParameter[];
}

export type AbiEntry = AbiFunctionEntry | Record<string, unknown>;

export interface ParsedAbiParameter {
  name: string;
  type: string;
  canonicalType: string;
  components: ParsedAbiParameter[];
  isArray: boolean;
  arraySuffix: string;
  isTuple: boolean;
}

export interface ParsedAbiFunction {
  id: string;
  name: string;
  signature: string;
  stateMutability: AbiStateMutability;
  kind: "read" | "write" | "payable";
  inputs: ParsedAbiParameter[];
  outputs: ParsedAbiParameter[];
}

export interface SelectedFunctionConfig {
  signature: string;
  label: string;
  description?: string;
  order: number;
  argumentLabels?: Record<string, string>;
  defaults?: Record<string, string>;
}

export type WorkflowFallback = "abort" | "continue";
export type WorkflowCondition = "always" | "previous-success";

export interface WorkflowBinding {
  source: "static" | "previousResult";
  value?: unknown;
  path?: string;
}

export interface WorkflowStepConfig {
  id: string;
  functionSignature: string;
  label: string;
  retryCount?: number;
  fallback?: WorkflowFallback;
  condition?: WorkflowCondition;
  argumentBindings?: Record<string, WorkflowBinding>;
}

export interface WorkflowConfig {
  id: string;
  label: string;
  description?: string;
  steps: WorkflowStepConfig[];
}

export interface Eip712DomainConfig {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface ProjectConfig {
  projectName: string;
  version: string;
  chain: {
    chainId: number;
    name: string;
  };
  contract: {
    address: string;
    abi: AbiEntry[];
  };
  selectedFunctions: SelectedFunctionConfig[];
  backendEndpoints: {
    sign: string;
    execute: string;
    publicConfig?: string;
  };
  eip712: Eip712DomainConfig;
  workflows: WorkflowConfig[];
}
