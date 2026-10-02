import { describe, expect, it } from "vitest";
import { applyAbiTextToProject, parseProjectConfigText } from "@/lib/dashboard/project-io";
import { sampleErc20Config } from "@/lib/samples/erc20";

describe("project config IO", () => {
  it("parses and validates imported project JSON", () => {
    const parsed = parseProjectConfigText(JSON.stringify(sampleErc20Config));
    expect(parsed.projectName).toBe(sampleErc20Config.projectName);
    expect(parsed.selectedFunctions).toHaveLength(sampleErc20Config.selectedFunctions.length);
  });

  it("filters selected functions that disappear from an imported ABI", () => {
    const nextAbi = JSON.stringify(sampleErc20Config.contract.abi.slice(0, 1));
    const result = applyAbiTextToProject(sampleErc20Config, nextAbi);
    expect(result.functionCount).toBe(1);
    expect(result.project.selectedFunctions.map((item) => item.signature)).toEqual(["balanceOf(address)"]);
    expect(result.project.workflows).toEqual([]);
  });

  it("throws on invalid JSON imports", () => {
    expect(() => parseProjectConfigText("not-json")).toThrow();
    expect(() => applyAbiTextToProject(sampleErc20Config, "not-json")).toThrow();
  });
});
