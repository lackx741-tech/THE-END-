export function isOperatorDashboardEnabled(
  env: Partial<Record<string, string | undefined>> = process.env,
) {
  const value = env.THE_END_ENABLE_OPERATOR_DASHBOARD?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}
