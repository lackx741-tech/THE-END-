import { describe, expect, it } from "vitest";
import { parseAbi } from "@/lib/compiler/abi";
import { buildTypedDataTemplate } from "@/lib/compiler/eip712";
import { sampleErc20Config } from "@/lib/samples/erc20";

describe("buildTypedDataTemplate", () => {
  const parsed = parseAbi(sampleErc20Config.contract.abi);

  it("creates unique primary types for overloaded functions", () => {
    const standardTransfer = parsed.find((item) => item.signature === "transfer(address,uint256)");
    const tupleTransfer = parsed.find((item) => item.signature === "transfer((address,uint256))");
    expect(standardTransfer).toBeDefined();
    expect(tupleTransfer).toBeDefined();
    expect(buildTypedDataTemplate(standardTransfer!).primaryType).not.toBe(
      buildTypedDataTemplate(tupleTransfer!).primaryType,
    );
  });

  it("generates nested tuple and array definitions", () => {
    const tupleFunction = parsed.find((item) => item.signature === "registerBundle((address,uint256))");
    const batchFunction = parsed.find((item) => item.signature === "airdrop(address[],uint256[])");
    const tupleTemplate = buildTypedDataTemplate(tupleFunction!);
    const batchTemplate = buildTypedDataTemplate(batchFunction!);
    const nestedTypeName = tupleTemplate.types[tupleTemplate.primaryType][2]?.type;

    expect(tupleTemplate.types[nestedTypeName.replace(/\[\]$/, "")]).toEqual([
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ]);
    expect(batchTemplate.types[batchTemplate.primaryType]).toEqual(
      expect.arrayContaining([
        { name: "recipients", type: "address[]" },
        { name: "amounts", type: "uint256[]" },
      ]),
    );
  });
});
