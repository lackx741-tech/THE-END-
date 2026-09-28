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

  it("canonicalizes ABI aliases and keeps overload ids distinct", () => {
    const functions = parseAbiJson(
      JSON.stringify([
        {
          type: "function",
          name: "foo",
          inputs: [
            { name: "first", type: "address" },
            { name: "second", type: "address[]" },
            { name: "third", type: "address[]" },
            { name: "fourth", type: "address" },
          ],
          outputs: [],
        },
        {
          type: "function",
          name: "foo",
          inputs: [
            { name: "first", type: "address[]" },
            { name: "second", type: "address" },
            { name: "third", type: "address" },
            { name: "fourth", type: "address[]" },
          ],
          outputs: [],
        },
        {
          type: "function",
          name: "aliases",
          inputs: [
            { name: "count", type: "int" },
            { name: "single", type: "byte" },
            { name: "price", type: "fixed" },
            { name: "rate", type: "ufixed" },
            {
              name: "bundle",
              type: "tuple",
              components: [
                { name: "values", type: "uint[2]" },
                { name: "matrix", type: "int[][3]" },
              ],
            },
            {
              name: "bundles",
              type: "tuple[]",
              components: [{ name: "values", type: "uint[2]" }],
            },
          ],
          outputs: [],
        },
      ]),
    );

    expect(functions.map((item) => item.signature)).toContain("foo(address,address[],address[],address)");
    expect(functions.map((item) => item.signature)).toContain("foo(address[],address,address,address[])");
    expect(new Set(functions.map((item) => item.id)).size).toBe(functions.length);
    expect(functions.find((item) => item.name === "aliases")?.signature).toBe(
      "aliases(int256,bytes1,fixed128x18,ufixed128x18,(uint256[2],int256[][3]),(uint256[2])[])",
    );
  });
});
