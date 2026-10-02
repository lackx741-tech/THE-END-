import { parseAbiJson } from "@/lib/compiler/abi";
import { pruneWorkflowsForSelectedFunctions, validateProjectConfig } from "@/lib/compiler/config";
import type { AbiEntry, ProjectConfig } from "@/lib/compiler/types";

export function parseProjectConfigText(text: string) {
  return validateProjectConfig(JSON.parse(text) as ProjectConfig);
}

export function applyAbiTextToProject(project: ProjectConfig, text: string) {
  const parsedAbi = JSON.parse(text) as AbiEntry[];
  const abiFunctions = parseAbiJson(text);
  const selectedFunctions = project.selectedFunctions.filter((item) =>
    abiFunctions.some((fn) => fn.signature === item.signature),
  );

  return {
    project: {
      ...project,
      contract: {
        ...project.contract,
        abi: parsedAbi,
      },
      selectedFunctions,
      workflows: pruneWorkflowsForSelectedFunctions(project.workflows, selectedFunctions),
    },
    functionCount: abiFunctions.length,
  };
}
