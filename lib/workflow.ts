import type { ProjectConfig } from "@/lib/schema";

export type WorkflowDiagnostic = {
  level: "error" | "warning";
  message: string;
};

export function validateWorkflows(
  config: ProjectConfig,
  availableArgumentNames?: Map<string, Set<string>>,
): WorkflowDiagnostic[] {
  const diagnostics: WorkflowDiagnostic[] = [];
  const selected = new Map(
    config.selectedFunctions.map((fn) => [fn.signature, fn]),
  );
  const fallbackArgumentNamesBySignature = new Map(
    config.selectedFunctions.map((fn) => [fn.signature, new Set(Object.keys(fn.arguments))]),
  );

  for (const workflow of config.workflows) {
    workflow.steps.forEach((step, index) => {
      const selectedFunction = selected.get(step.signature);
      if (!selectedFunction) {
        diagnostics.push({
          level: "error",
          message: `[${workflow.name}] Step ${index + 1} references unselected function ${step.signature}`,
        });
        return;
      }

      const knownArgs =
        availableArgumentNames?.get(step.signature) ??
        fallbackArgumentNamesBySignature.get(step.signature) ??
        new Set<string>();
      for (const requiredArg of step.requiredArguments) {
        if (!knownArgs.has(requiredArg)) {
          diagnostics.push({
            level: "error",
            message: `[${workflow.name}] Step ${index + 1} requires missing argument '${requiredArg}' for ${step.signature}`,
          });
        }
      }

      if (step.retryAttempts > 0 && step.backoffMs === 0) {
        diagnostics.push({
          level: "warning",
          message: `[${workflow.name}] Step ${index + 1} retries enabled with zero backoff`,
        });
      }
    });
  }

  return diagnostics;
}
