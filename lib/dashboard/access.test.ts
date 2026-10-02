import { describe, expect, it } from "vitest";
import { isOperatorDashboardEnabled } from "@/lib/dashboard/access";

describe("isOperatorDashboardEnabled", () => {
  it("defaults to disabled", () => {
    expect(isOperatorDashboardEnabled({})).toBe(false);
  });

  it("accepts explicit truthy deployment flags", () => {
    expect(isOperatorDashboardEnabled({ THE_END_ENABLE_OPERATOR_DASHBOARD: "true" })).toBe(true);
    expect(isOperatorDashboardEnabled({ THE_END_ENABLE_OPERATOR_DASHBOARD: "1" })).toBe(true);
    expect(isOperatorDashboardEnabled({ THE_END_ENABLE_OPERATOR_DASHBOARD: " yes " })).toBe(true);
  });
});
