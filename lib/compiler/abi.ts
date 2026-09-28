import { slugify } from "@/lib/utils";
import type {
  AbiEntry,
  AbiFunctionEntry,
  AbiParameter,
  AbiStateMutability,
  ParsedAbiFunction,
  ParsedAbiParameter,
} from "@/lib/compiler/types";

function inferStateMutability(entry: AbiFunctionEntry): AbiStateMutability {
  if (entry.stateMutability) {
    return entry.stateMutability;
  }

  if (entry.payable) {
    return "payable";
  }

  if (entry.constant) {
    return "view";
  }

  return "nonpayable";
}

export function canonicalAbiType(parameter: AbiParameter): string {
  if (!parameter.type.startsWith("tuple")) {
    return parameter.type;
  }

  const suffix = parameter.type.slice("tuple".length);
  const componentTypes = (parameter.components ?? []).map(canonicalAbiType).join(",");
  return `(${componentTypes})${suffix}`;
}

function parseParameter(parameter: AbiParameter, index: number): ParsedAbiParameter {
  const name = parameter.name?.trim() || `arg${index}`;
  const canonicalType = canonicalAbiType(parameter);
  const arraySuffixMatch = canonicalType.match(/(\[[^\]]*\])+$/);
  const arraySuffix = arraySuffixMatch?.[0] ?? "";
  const isArray = arraySuffix.length > 0;
  const isTuple = parameter.type.startsWith("tuple");

  return {
    name,
    type: parameter.type,
    canonicalType,
    components: (parameter.components ?? []).map((component, componentIndex) =>
      parseParameter(component, componentIndex),
    ),
    isArray,
    arraySuffix,
    isTuple,
  };
}

export function classifyFunction(stateMutability: AbiStateMutability) {
  if (stateMutability === "view" || stateMutability === "pure") {
    return "read" as const;
  }

  if (stateMutability === "payable") {
    return "payable" as const;
  }

  return "write" as const;
}

export function functionSignature(entry: AbiFunctionEntry): string {
  const inputs = (entry.inputs ?? []).map(canonicalAbiType).join(",");
  return `${entry.name}(${inputs})`;
}

export function parseAbi(abi: AbiEntry[]): ParsedAbiFunction[] {
  return abi
    .filter((entry): entry is AbiFunctionEntry => entry.type === "function" && typeof entry.name === "string")
    .map((entry) => {
      const stateMutability = inferStateMutability(entry);
      const signature = functionSignature(entry);

      return {
        id: slugify(signature),
        name: entry.name,
        signature,
        stateMutability,
        kind: classifyFunction(stateMutability),
        inputs: (entry.inputs ?? []).map((input, index) => parseParameter(input, index)),
        outputs: (entry.outputs ?? []).map((output, index) => parseParameter(output, index)),
      } satisfies ParsedAbiFunction;
    })
    .sort((left, right) => left.signature.localeCompare(right.signature));
}

export function parseAbiJson(abiJson: string): ParsedAbiFunction[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(abiJson);
  } catch (error) {
    throw new Error(`Invalid ABI JSON: ${(error as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("ABI JSON must be an array.");
  }

  return parseAbi(parsed as AbiEntry[]);
}
