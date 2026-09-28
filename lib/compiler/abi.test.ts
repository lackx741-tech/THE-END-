import { describe, expect, it } from "vitest";
import { parseAbiJson } from "@/lib/compiler/abi";
import { sampleErc20Config } from "@/lib/samples/erc20";

describe("parseAbiJson", () => {
  it("classifies functions and preserves overload signatures", () => {
    const functions = parseAbiJson(JSON.stringify(sampleErc20Config.contract.abi));
    expect(functions.map((item) => item.signature)).toContain("transfer(address,uint256)");
    expect(functions.map((item) => item.signature)).toContain("transfer((address,uint256))");
    expect(functions.find((item) => item.signature === "balanceOf(address)")?.kind).toBe("read");
    expect(functions.find((item) => item.signature === "airdrop(address[],uint256[])")?.inputs[0]?.isArray).toBe(true);
    expect(functions.find((item) => item.signature === "registerBundle((address,uint256))")?.inputs[0]?.isTuple).toBe(true);
  });

  it("rejects non-array ABI JSON", () => {
    expect(() => parseAbiJson("{}")) .toThrow("ABI JSON must be an array.");
  });
});
