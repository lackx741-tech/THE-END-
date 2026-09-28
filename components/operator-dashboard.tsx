"use client";

import { Download, FileCode2, RefreshCcw, Sparkles, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { parseAbi, parseAbiJson } from "@/lib/compiler/abi";
import { compileStandaloneScript } from "@/lib/compiler/compiler";
import { validateProjectConfig } from "@/lib/compiler/config";
import type { AbiEntry, ProjectConfig, SelectedFunctionConfig, WorkflowConfig } from "@/lib/compiler/types";
import { applyAbiTextToProject, parseProjectConfigText } from "@/lib/dashboard/project-io";
import { sampleErc20Config } from "@/lib/samples/erc20";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function cloneSample(): ProjectConfig {
  return JSON.parse(JSON.stringify(sampleErc20Config)) as ProjectConfig;
}

function selectedMap(items: SelectedFunctionConfig[]) {
  return new Map(items.map((item) => [item.signature, item]));
}

function renumberSelectedFunctions(items: SelectedFunctionConfig[]) {
  return [...items]
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.signature.localeCompare(right.signature);
    })
    .map((item, index) => ({ ...item, order: index + 1 }));
}

function fieldId(...parts: string[]) {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OperatorDashboard() {
  const [project, setProject] = useState<ProjectConfig>(cloneSample);
  const [abiText, setAbiText] = useState(prettyJson(sampleErc20Config.contract.abi));
  const [workflowText, setWorkflowText] = useState(prettyJson(sampleErc20Config.workflows));
  const [compileOutput, setCompileOutput] = useState(() => compileStandaloneScript(sampleErc20Config));
  const [status, setStatus] = useState<string>("Sample ERC-20 project loaded.");
  const [error, setError] = useState<string>("");

  const availableFunctions = useMemo(() => parseAbi(project.contract.abi), [project.contract.abi]);
  const selected = useMemo(() => selectedMap(project.selectedFunctions), [project.selectedFunctions]);

  function updateProject(patch: Partial<ProjectConfig>) {
    setProject((current) => ({ ...current, ...patch }));
  }

  function syncAbi() {
    try {
      const parsed = JSON.parse(abiText) as AbiEntry[];
      const abiFunctions = parseAbiJson(abiText);
      const nextSelected = abiFunctions
        .filter((item) => selected.has(item.signature))
        .map((item, index) => {
          const existing = selected.get(item.signature)!;
          return { ...existing, order: existing.order ?? index + 1 };
        });
      const nextProject = validateProjectConfig({
        ...project,
        contract: {
          ...project.contract,
          abi: parsed,
        },
        selectedFunctions: nextSelected,
      });

      setProject(nextProject);
      setError("");
      setStatus(`Parsed ABI successfully with ${abiFunctions.length} callable functions.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  function syncWorkflows() {
    try {
      const parsed = JSON.parse(workflowText) as WorkflowConfig[];
      const nextProject = validateProjectConfig({ ...project, workflows: parsed });
      setProject(nextProject);
      setError("");
      setStatus(`Loaded ${parsed.length} workflow definition(s).`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  const importProjectConfig = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseProjectConfigText(text);
      setProject(parsed);
      setAbiText(prettyJson(parsed.contract.abi));
      setWorkflowText(prettyJson(parsed.workflows));
      setCompileOutput(compileStandaloneScript(parsed));
      setError("");
      setStatus(`Loaded project configuration: ${parsed.projectName}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  const importAbiFile = async (file: File) => {
    try {
      const text = await file.text();
      const abiFunctions = parseAbiJson(text);
      const nextProject = validateProjectConfig(applyAbiTextToProject(project, text).project);
      setAbiText(text);
      setProject(nextProject);
      setError("");
      setStatus(`Uploaded ABI with ${abiFunctions.length} callable functions.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  function toggleFunction(signature: string, label: string) {
    setProject((current) => {
      const existing = current.selectedFunctions.find((item) => item.signature === signature);
      if (existing) {
        return {
          ...current,
          selectedFunctions: renumberSelectedFunctions(
            current.selectedFunctions.filter((item) => item.signature !== signature),
          ),
          workflows: current.workflows
            .map((workflow) => ({
              ...workflow,
              steps: workflow.steps.filter((step) => step.functionSignature !== signature),
            }))
            .filter((workflow) => workflow.steps.length > 0),
        };
      }

      return {
        ...current,
        selectedFunctions: renumberSelectedFunctions([
          ...current.selectedFunctions,
          {
            signature,
            label,
            order: current.selectedFunctions.length + 1,
          },
        ]),
      };
    });
  }

  function updateSelectedFunction(signature: string, patch: Partial<SelectedFunctionConfig>) {
    setProject((current) => ({
      ...current,
      selectedFunctions: renumberSelectedFunctions(
        current.selectedFunctions.map((item) =>
          item.signature === signature ? { ...item, ...patch } : item,
        ),
      ),
    }));
  }

  function compile() {
    try {
      const validated = validateProjectConfig(project);
      setProject(validated);
      const nextOutput = compileStandaloneScript(validated);
      setCompileOutput(nextOutput);
      setWorkflowText(prettyJson(validated.workflows));
      setError("");
      setStatus(`Compiled standalone script successfully (${nextOutput.length.toLocaleString()} bytes).`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  function loadSample() {
    const sample = cloneSample();
    setProject(sample);
    setAbiText(prettyJson(sample.contract.abi));
    setWorkflowText(prettyJson(sample.workflows));
    setCompileOutput(compileStandaloneScript(sample));
    setError("");
    setStatus("Loaded the bundled ERC-20 sample project.");
  }

  function downloadOutput() {
    const blob = new Blob([compileOutput], { type: "application/javascript;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${project.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "project"}-script.js`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function downloadProjectConfig() {
    const blob = new Blob([prettyJson(project)], { type: "application/json;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${project.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "project"}-config.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <Badge className="w-fit">Private operator control plane</Badge>
            <CardTitle className="text-3xl">Compile backend-routed EIP-712 transaction clients</CardTitle>
            <CardDescription>
              Paste or upload ABI metadata, choose the public functions to expose, define typed-data
              structure, configure workflow retry/fallback rules, and deterministically generate a single
              standalone JavaScript runtime for end users.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-slate-300" htmlFor="project-name">
                Project name
              </label>
              <Input
                id="project-name"
                value={project.projectName}
                onChange={(event) => updateProject({ projectName: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300" htmlFor="project-version">
                Version
              </label>
              <Input
                id="project-version"
                value={project.version}
                onChange={(event) => updateProject({ version: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300" htmlFor="chain-name">
                Chain name
              </label>
              <Input
                id="chain-name"
                value={project.chain.name}
                onChange={(event) => updateProject({ chain: { ...project.chain, name: event.target.value } })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300" htmlFor="chain-id">
                Chain ID
              </label>
              <Input
                id="chain-id"
                type="number"
                value={String(project.chain.chainId)}
                onChange={(event) =>
                  updateProject({
                    chain: { ...project.chain, chainId: Number(event.target.value || 0) },
                    eip712: { ...project.eip712, chainId: Number(event.target.value || 0) },
                  })
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-slate-300" htmlFor="contract-address">
                Contract address
              </label>
              <Input
                id="contract-address"
                value={project.contract.address}
                onChange={(event) =>
                  setProject((current) => ({
                    ...current,
                    contract: { ...current.contract, address: event.target.value },
                    eip712: { ...current.eip712, verifyingContract: event.target.value },
                  }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-slate-300" htmlFor="backend-sign">
                Backend /sign endpoint
              </label>
              <Input
                id="backend-sign"
                value={project.backendEndpoints.sign}
                onChange={(event) =>
                  updateProject({
                    backendEndpoints: { ...project.backendEndpoints, sign: event.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-slate-300" htmlFor="backend-execute">
                Backend /execute endpoint
              </label>
              <Input
                id="backend-execute"
                value={project.backendEndpoints.execute}
                onChange={(event) =>
                  updateProject({
                    backendEndpoints: { ...project.backendEndpoints, execute: event.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-slate-300" htmlFor="backend-public-config">
                Optional public config endpoint
              </label>
              <Input
                id="backend-public-config"
                value={project.backendEndpoints.publicConfig ?? ""}
                onChange={(event) =>
                  updateProject({
                    backendEndpoints: {
                      ...project.backendEndpoints,
                      publicConfig: event.target.value || undefined,
                    },
                  })
                }
              />
            </div>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <Button type="button" onClick={loadSample}>
                <Sparkles className="mr-2 h-4 w-4" />
                Load ERC-20 sample
              </Button>
              <Button type="button" variant="secondary" onClick={compile}>
                <Wand2 className="mr-2 h-4 w-4" />
                Compile script.js
              </Button>
              <Button type="button" variant="secondary" onClick={downloadProjectConfig}>
                Export project JSON
              </Button>
              <label className="inline-flex cursor-pointer items-center rounded-full bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12">
                Import project JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void importProjectConfig(file);
                      event.target.value = "";
                    }
                  }}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge className="w-fit">Compiler state</Badge>
            <CardTitle>Deterministic output</CardTitle>
            <CardDescription>
              Recompiling the same validated configuration yields byte-identical standalone output.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              {status}
            </div>
            {error ? (
              <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                {error}
              </div>
            ) : null}
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-300">
              <p>
                <strong>Selected functions:</strong> {project.selectedFunctions.length}
              </p>
              <p>
                <strong>Workflows:</strong> {project.workflows.length}
              </p>
              <p>
                <strong>Preview bytes:</strong> {compileOutput.length.toLocaleString()}
              </p>
            </div>
            <Button type="button" onClick={downloadOutput} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Download generated script.js
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>ABI source</CardTitle>
                <CardDescription>
                  Paste contract ABI JSON. Tuple and array definitions are preserved for overload-safe
                  signatures and typed-data generation.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center rounded-full bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12">
                  Upload ABI JSON
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void importAbiFile(file);
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
                <Button type="button" variant="secondary" onClick={syncAbi}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Parse ABI
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="abi-json">
              ABI JSON
            </label>
            <Textarea
              id="abi-json"
              value={abiText}
              onChange={(event) => setAbiText(event.target.value)}
              className="min-h-[420px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Function selection</CardTitle>
            <CardDescription>
              Select end-user actions, customize labels, set defaults, and order button rendering.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableFunctions.map((fn) => {
              const current = selected.get(fn.signature);
              return (
                <div key={fn.signature} className="rounded-3xl border border-white/10 bg-white/4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={fieldId("select", fn.signature)}
                          checked={Boolean(current)}
                          onChange={() => toggleFunction(fn.signature, fn.name)}
                        />
                        <label className="font-medium text-white" htmlFor={fieldId("select", fn.signature)}>
                          {fn.signature}
                        </label>
                        <Badge>{fn.kind}</Badge>
                      </div>
                      <p className="text-sm text-slate-400">
                        Inputs: {fn.inputs.length} · Outputs: {fn.outputs.length} · Mutability: {fn.stateMutability}
                      </p>
                    </div>
                  </div>
                  {current ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm text-slate-300" htmlFor={fieldId(fn.signature, "label")}>
                          Public label
                        </label>
                        <Input
                          id={fieldId(fn.signature, "label")}
                          value={current.label}
                          onChange={(event) =>
                            updateSelectedFunction(fn.signature, { label: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-slate-300" htmlFor={fieldId(fn.signature, "order")}>
                          Order
                        </label>
                        <Input
                          id={fieldId(fn.signature, "order")}
                          type="number"
                          value={String(current.order)}
                          onChange={(event) =>
                            updateSelectedFunction(fn.signature, { order: Number(event.target.value || 0) })
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label
                          className="text-sm text-slate-300"
                          htmlFor={fieldId(fn.signature, "description")}
                        >
                          Description
                        </label>
                        <Input
                          id={fieldId(fn.signature, "description")}
                          value={current.description ?? ""}
                          onChange={(event) =>
                            updateSelectedFunction(fn.signature, { description: event.target.value })
                          }
                        />
                      </div>
                      {fn.inputs.map((input) => (
                        <div key={input.name} className="space-y-2">
                          <label
                            className="text-sm text-slate-300"
                            htmlFor={fieldId(fn.signature, input.name, "default")}
                          >
                            {input.name} default
                          </label>
                          <Input
                            id={fieldId(fn.signature, input.name, "default")}
                            value={current.defaults?.[input.name] ?? ""}
                            onChange={(event) =>
                              updateSelectedFunction(fn.signature, {
                                defaults: {
                                  ...(current.defaults ?? {}),
                                  [input.name]: event.target.value,
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Workflow and release config</CardTitle>
                <CardDescription>
                  Edit workflow steps, retry counts, fallback behavior, and previous-step dependency paths as
                  JSON for the initial vertical slice.
                </CardDescription>
              </div>
              <Button type="button" variant="secondary" onClick={syncWorkflows}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Load workflows
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="eip712-name">
                  EIP-712 domain name
                </label>
                <Input
                  id="eip712-name"
                  value={project.eip712.name}
                  onChange={(event) =>
                    updateProject({ eip712: { ...project.eip712, name: event.target.value } })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="eip712-version">
                  EIP-712 domain version
                </label>
                <Input
                  id="eip712-version"
                  value={project.eip712.version}
                  onChange={(event) =>
                    updateProject({ eip712: { ...project.eip712, version: event.target.value } })
                  }
                />
              </div>
            </div>
            <label className="text-sm text-slate-300" htmlFor="workflow-json">
              Workflow JSON
            </label>
            <Textarea
              id="workflow-json"
              value={workflowText}
              onChange={(event) => setWorkflowText(event.target.value)}
              className="min-h-[260px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generated script preview</CardTitle>
            <CardDescription>
              The compiler emits a single self-contained runtime with inline UI, EIP-712 signing calls, and
              backend POST requests. No import or require statements are emitted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={compile}>
                <FileCode2 className="mr-2 h-4 w-4" />
                Recompile preview
              </Button>
              <Button type="button" variant="secondary" onClick={downloadOutput}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
            <Textarea readOnly value={compileOutput} className="min-h-[520px] font-mono text-xs" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
