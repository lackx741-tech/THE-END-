import { parseAbiJson } from "@/lib/compiler/abi";
import { validateProjectConfig } from "@/lib/compiler/config";
import type { AbiEntry, ProjectConfig } from "@/lib/compiler/types";

export function parseProjectConfigText(text: string) {
  return validateProjectConfig(JSON.parse(text) as ProjectConfig);
}

export function applyAbiTextToProject(project: ProjectConfig, text: string) {
  const parsedAbi = JSON.parse(text) as AbiEntry[];
  const abiFunctions = parseAbiJson(text);

  return {
    project: {
      ...project,
      contract: {
        ...project.contract,
        abi: parsedAbi,
      },
      selectedFunctions: project.selectedFunctions.filter((item) =>
        abiFunctions.some((fn) => fn.signature === item.signature),
      ),
    },
    functionCount: abiFunctions.length,
  };
}
