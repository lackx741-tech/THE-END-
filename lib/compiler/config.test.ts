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
});
