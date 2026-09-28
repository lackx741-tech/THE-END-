import type {
  Eip712DomainConfig,
  ParsedAbiFunction,
  ParsedAbiParameter,
} from "@/lib/compiler/types";

export interface Eip712Field {
  name: string;
  type: string;
}

export interface Eip712Template {
  primaryType: string;
  types: Record<string, Eip712Field[]>;
  messageDefaults: Record<string, unknown>;
}

const DOMAIN_FIELDS: Eip712Field[] = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];

function toTypeBaseName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");
}

function checksum(value: string) {
  return value
    .split("")
    .reduce((sum, character, index) => (sum + character.charCodeAt(0) * (index + 1)) % 100000, 0)
    .toString()
    .padStart(5, "0");
}

function buildTupleTypeName(parentType: string, parameter: ParsedAbiParameter) {
  return `${parentType}${toTypeBaseName(parameter.name)}`;
}

function createMessageDefault(parameter: ParsedAbiParameter): unknown {
  if (parameter.isArray) {
    return [];
  }

  if (parameter.isTuple) {
    return Object.fromEntries(parameter.components.map((component) => [component.name, createMessageDefault(component)]));
  }

  if (parameter.canonicalType === "bool") {
    return false;
  }

  return "";
}

function addParameterTypes(
  parameter: ParsedAbiParameter,
  parentType: string,
  types: Record<string, Eip712Field[]>,
): string {
  if (!parameter.isTuple) {
    return parameter.canonicalType;
  }

  const tupleTypeName = buildTupleTypeName(parentType, parameter);
  if (!types[tupleTypeName]) {
    types[tupleTypeName] = parameter.components.map((component) => ({
      name: component.name,
      type: addParameterTypes(component, tupleTypeName, types),
    }));
  }

  return `${tupleTypeName}${parameter.arraySuffix}`;
}

export function buildTypedDataTemplate(parsedFunction: ParsedAbiFunction): Eip712Template {
  const primaryType = `${toTypeBaseName(parsedFunction.name)}${checksum(parsedFunction.signature)}Request`;
  const types: Record<string, Eip712Field[]> = {
    EIP712Domain: DOMAIN_FIELDS,
  };

  types[primaryType] = [
    { name: "projectName", type: "string" },
    { name: "functionSignature", type: "string" },
    ...parsedFunction.inputs.map((parameter) => ({
      name: parameter.name,
      type: addParameterTypes(parameter, primaryType, types),
    })),
  ];

  return {
    primaryType,
    types,
    messageDefaults: {
      projectName: "",
      functionSignature: parsedFunction.signature,
      ...Object.fromEntries(
        parsedFunction.inputs.map((parameter) => [parameter.name, createMessageDefault(parameter)]),
      ),
    },
  };
}

export function buildTypedDataDocument(
  parsedFunction: ParsedAbiFunction,
  domain: Eip712DomainConfig,
  projectName: string,
  args: Record<string, unknown>,
) {
  const template = buildTypedDataTemplate(parsedFunction);

  return {
    domain,
    primaryType: template.primaryType,
    types: template.types,
    message: {
      ...template.messageDefaults,
      ...args,
      projectName,
      functionSignature: parsedFunction.signature,
    },
  };
}
