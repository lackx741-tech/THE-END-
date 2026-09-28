import { describe, expect, it } from "vitest";
import { validateProjectConfig } from "@/lib/compiler/config";
import { sampleErc20Config } from "@/lib/samples/erc20";

describe("validateProjectConfig", () => {
  it("sorts selected functions by configured order", () => {
    const reversed = {
      ...sampleErc20Config,
      selectedFunctions: [...sampleErc20Config.selectedFunctions].reverse(),
    };

    const validated = validateProjectConfig(reversed);
    expect(validated.selectedFunctions.map((item) => item.order)).toEqual([1, 2, 3, 4]);
  });

  it("rejects selected functions missing from the ABI", () => {
    expect(() =>
      validateProjectConfig({
        ...sampleErc20Config,
        selectedFunctions: [{ signature: "mint(address,uint256)", label: "Mint", order: 1 }],
      }),
    ).toThrow("Selected function not found in ABI");
  });

  it("rejects workflows that reference unselected functions", () => {
    expect(() =>
      validateProjectConfig({
        ...sampleErc20Config,
        selectedFunctions: sampleErc20Config.selectedFunctions.filter(
          (item) => item.signature !== "approve(address,uint256)",
        ),
      }),
    ).toThrow("Workflow step references a function that is not selected");
  });

  it("rejects workflows with unknown argument binding keys", () => {
    expect(() =>
      validateProjectConfig({
        ...sampleErc20Config,
        workflows: [
          {
            ...sampleErc20Config.workflows[0],
            steps: [
              {
                ...sampleErc20Config.workflows[0].steps[0],
                argumentBindings: {
                  invalidArg: {
                    source: "static",
                    value: "0x0000000000000000000000000000000000000000",
                  },
                },
              },
            ],
          },
        ],
      }),
    ).toThrow('Workflow step binding references unknown argument "invalidArg"');
  });

  it("rejects workflows with missing argument bindings", () => {
    expect(() =>
      validateProjectConfig({
        ...sampleErc20Config,
        workflows: [
          {
            ...sampleErc20Config.workflows[0],
            steps: [
              {
                ...sampleErc20Config.workflows[0].steps[0],
                argumentBindings: {
                  spender: {
                    source: "static",
                    value: "0x0000000000000000000000000000000000000000",
                  },
                },
              },
            ],
          },
        ],
      }),
    ).toThrow('Workflow step is missing binding for argument "amount"');
  });
});
