import { hashString } from "@/lib/stable";

export type AbiInput = {
  name?: string;
  type: string;
  internalType?: string;
  components?: AbiInput[];
};

export type AbiFunction = {
  type: "function";
  name: string;
  stateMutability?: "pure" | "view" | "nonpayable" | "payable";
  inputs?: AbiInput[];
  outputs?: AbiInput[];
};

export type NormalizedParam = {
  name: string;
  type: string;
  canonicalType: string;
  components?: NormalizedParam[];
  isArray: boolean;
  isTuple: boolean;
};

export type FunctionKind = "read" | "write" | "payable";

export type NormalizedFunction = {
  name: string;
  signature: string;
  canonicalSelectorHint: string;
  selectorTag: string;
  kind: FunctionKind;
  payable: boolean;
  inputs: NormalizedParam[];
  outputs: NormalizedParam[];
};

export type ParseAbiResult = {
  functions: NormalizedFunction[];
  errors: string[];
};

function parseArraySuffix(type: string): { base: string; arraySuffix: string } {
  const match = type.match(/^(.*?)(\[[^\]]*\])*$/);
  if (!match) return { base: type, arraySuffix: "" };
  const suffix = type.slice(match[1].length);
  return { base: match[1], arraySuffix: suffix };
}

const baseTypePattern =
  /^(address|bool|string|bytes|bytes([1-9]|[12][0-9]|3[0-2])|u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?)$/;

function normalizeParam(input: AbiInput, path: string): NormalizedParam {
  if (!input?.type || typeof input.type !== "string") {
    throw new Error(`Parameter at ${path} is missing a valid type`);
  }
  const { base, arraySuffix } = parseArraySuffix(input.type);
  const isTuple = base === "tuple";
  if (!isTuple && !baseTypePattern.test(base)) {
    throw new Error(`Unsupported ABI type '${input.type}' at ${path}`);
  }

  let components: NormalizedParam[] | undefined;
  if (isTuple) {
    if (!Array.isArray(input.components)) {
      throw new Error(`Tuple parameter at ${path} must provide components`);
    }
    components = input.components.map((component, index) =>
      normalizeParam(component, `${path}.components[${index}]`),
    );
  }

  const canonicalType = isTuple
    ? `(${(components ?? []).map((c) => c.canonicalType).join(",")})${arraySuffix}`
    : `${base}${arraySuffix}`;

  return {
    name: input.name && input.name.length > 0 ? input.name : "arg",
    type: input.type,
    canonicalType,
    components,
    isArray: arraySuffix.length > 0,
    isTuple,
  };
}

function kindFromMutability(
  mutability: AbiFunction["stateMutability"],
): FunctionKind {
  if (mutability === "view" || mutability === "pure") return "read";
  if (mutability === "payable") return "payable";
  return "write";
}

function normalizeFunction(fn: AbiFunction, idx: number): NormalizedFunction {
  const inputs = (fn.inputs ?? []).map((input, i) =>
    normalizeParam(input, `${fn.name}.inputs[${i}]`),
  );
  const outputs = (fn.outputs ?? []).map((output, i) =>
    normalizeParam(output, `${fn.name}.outputs[${i}]`),
  );
  const signature = `${fn.name}(${inputs.map((input) => input.canonicalType).join(",")})`;
  const canonicalSelectorHint = hashString(signature).slice(0, 10);

  return {
    name: fn.name,
    signature,
    canonicalSelectorHint,
    selectorTag: `${signature}#${idx}`,
    kind: kindFromMutability(fn.stateMutability),
    payable: fn.stateMutability === "payable",
    inputs,
    outputs,
  };
}

export function parseAndNormalizeAbi(rawAbiJson: string): ParseAbiResult {
  const errors: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawAbiJson);
  } catch (error) {
    return {
      functions: [],
      errors: [`ABI is not valid JSON: ${(error as Error).message}`],
    };
  }

  if (!Array.isArray(parsed)) {
    return { functions: [], errors: ["ABI JSON must be an array"] };
  }

  const functions: NormalizedFunction[] = [];

  parsed.forEach((entry, idx) => {
    const fn = entry as Partial<AbiFunction>;
    if (fn.type !== "function") return;

    if (!fn.name || typeof fn.name !== "string") {
      errors.push(`ABI function at index ${idx} is missing a valid name`);
      return;
    }

    try {
      functions.push(normalizeFunction(fn as AbiFunction, idx));
    } catch (error) {
      errors.push((error as Error).message);
    }
  });

  const sorted = functions.sort((a, b) => a.signature.localeCompare(b.signature));
  return { functions: sorted, errors };
}
