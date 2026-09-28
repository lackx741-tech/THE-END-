import { describe, expect, it } from "vitest";
import { compileStandaloneScript } from "@/lib/compiler/compiler";
import { sampleErc20Config } from "@/lib/samples/erc20";

describe("compileStandaloneScript", () => {
  it("is deterministic for identical input", () => {
    const first = compileStandaloneScript(sampleErc20Config);
    const second = compileStandaloneScript(sampleErc20Config);
    expect(first).toBe(second);
  });

  it("emits a standalone runtime with required signing and backend calls", () => {
    const output = compileStandaloneScript(sampleErc20Config);
    expect(output).not.toContain("import ");
    expect(output).not.toContain("require(");
    expect(output).toContain("eth_signTypedData_v4");
    expect(output).toContain(sampleErc20Config.backendEndpoints.sign);
    expect(output).toContain(sampleErc20Config.backendEndpoints.execute);
    expect(output).toContain("Check Balance");
    expect(output).toContain("Transfer Tokens");
    expect(output).toContain("Approve then Transfer");
  });
});
