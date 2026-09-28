"use client";

import { useEffect, useMemo, useState } from "react";
import { parseAndNormalizeAbi } from "@/lib/abi";
import { compileProjectDetailed } from "@/lib/compiler";
import { sampleProject } from "@/lib/sample";
import { projectConfigSchema, type ProjectConfig } from "@/lib/schema";

const STORAGE_KEY = "the-end-control-plane-v1";

function badge(kind: string) {
  if (kind === "read") return "bg-emerald-500/20 text-emerald-200 border-emerald-500/40";
  if (kind === "payable") return "bg-violet-500/20 text-violet-200 border-violet-500/40";
  return "bg-cyan-500/20 text-cyan-200 border-cyan-500/40";
}

const tabs = [
  "Overview",
  "Contract/ABI",
  "Functions",
  "Workflows",
  "Appearance",
  "Compile/Export",
] as const;

type Tab = (typeof tabs)[number];

function clampInt(value: string, min: number, max: number) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [config, setConfig] = useState<ProjectConfig>(() => {
    if (typeof window === "undefined") return sampleProject;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return sampleProject;
    try {
      const parsed = projectConfigSchema.safeParse(JSON.parse(saved));
      return parsed.success ? parsed.data : sampleProject;
    } catch {
      return sampleProject;
    }
  });
  const [query, setQuery] = useState("");
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [compileResult, setCompileResult] = useState<ReturnType<
    typeof compileProjectDetailed
  > | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const abi = useMemo(() => parseAndNormalizeAbi(config.rawAbiJson), [config.rawAbiJson]);
  const selectedSignatures = useMemo(
    () => new Set(config.selectedFunctions.map((fn) => fn.signature)),
    [config.selectedFunctions],
  );

  const filteredFns = abi.functions.filter((fn) =>
    fn.signature.toLowerCase().includes(query.toLowerCase()),
  );

  const overviewCompile = compileResult?.manifest as
    | { outputHash?: string; selectedFunctionCount?: number }
    | undefined;

  const parseAbiNow = () => {
    setDiagnostics(abi.errors.length ? abi.errors : ["ABI parsed successfully"]);
  };

  const toggleFunction = (signature: string) => {
    if (abi.errors.length > 0) return;
    if (selectedSignatures.has(signature)) {
      setConfig((prev) => ({
        ...prev,
        selectedFunctions: prev.selectedFunctions
          .filter((fn) => fn.signature !== signature)
          .map((fn, idx) => ({ ...fn, order: idx })),
      }));
      return;
    }

    setConfig((prev) => ({
      ...prev,
      selectedFunctions: [
        ...prev.selectedFunctions,
        {
          signature,
          order: prev.selectedFunctions.length,
          customLabel: signature,
          description: "",
          arguments: {},
        },
      ],
    }));
  };

  const updateSelectedMeta = (
    signature: string,
    field: "customLabel" | "description",
    value: string,
  ) => {
    setConfig((prev) => ({
      ...prev,
      selectedFunctions: prev.selectedFunctions.map((fn) =>
        fn.signature === signature ? { ...fn, [field]: value } : fn,
      ),
    }));
  };

  const reorder = (signature: string, direction: -1 | 1) => {
    setConfig((prev) => {
      const items = [...prev.selectedFunctions].sort((a, b) => a.order - b.order);
      const index = items.findIndex((item) => item.signature === signature);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= items.length) return prev;
      [items[index], items[next]] = [items[next], items[index]];
      return {
        ...prev,
        selectedFunctions: items.map((item, idx) => ({ ...item, order: idx })),
      };
    });
  };

  const compile = () => {
    const result = compileProjectDetailed(config);
    setCompileResult(result);
  };

  const downloadScript = () => {
    if (!compileResult?.script) return;
    const blob = new Blob([compileResult.script], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "script.js";
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateWorkflowStep = (
    workflowName: string,
    stepId: string,
    patch: Record<string, unknown>,
  ) => {
    setConfig((prev) => ({
      ...prev,
      workflows: prev.workflows.map((workflow) =>
        workflow.name !== workflowName
          ? workflow
          : {
              ...workflow,
              steps: workflow.steps.map((step) =>
                step.id === stepId ? { ...step, ...patch } : step,
              ),
            },
      ),
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-900/70 p-4">
          <h1 className="text-xl font-semibold tracking-tight">THE-END Control Plane</h1>
          <p className="mt-1 text-sm text-slate-400">Private dashboard → deterministic script.js compiler</p>
          <nav className="mt-5 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  activeTab === tab
                    ? "border-indigo-500 bg-indigo-500/20 text-white"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </aside>

        <main className="p-5 lg:p-8">
          <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{config.projectName}</h2>
                <p className="text-sm text-slate-400">Version {config.version} · Chain {config.chainId}</p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>Selected functions: {config.selectedFunctions.length}</div>
                <div>Compile hash: {overviewCompile?.outputHash ?? "Not compiled"}</div>
              </div>
            </div>
          </header>

          {activeTab === "Overview" && (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card title="Project Status" value="Local persisted" />
              <Card title="Contract" value={config.contractAddress} />
              <Card title="Chain" value={`${config.chainId}`} />
              <Card title="Compile" value={overviewCompile?.outputHash ?? "Pending"} />
            </section>
          )}

          {activeTab === "Contract/ABI" && (
            <section className="space-y-4">
              <Panel>
                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledInput
                    label="Contract Address"
                    value={config.contractAddress}
                    onChange={(value) => setConfig({ ...config, contractAddress: value })}
                  />
                  <LabeledInput
                    label="RPC URL"
                    value={config.rpcUrl}
                    onChange={(value) => setConfig({ ...config, rpcUrl: value })}
                  />
                </div>
                <div className="mt-3">
                  <label className="text-sm text-slate-300">Raw ABI JSON</label>
                  <textarea
                    className="mt-1 h-64 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs"
                    value={config.rawAbiJson}
                    onChange={(event) => setConfig({ ...config, rawAbiJson: event.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={parseAbiNow}
                  className="mt-3 rounded-lg border border-indigo-500 bg-indigo-500/20 px-4 py-2 text-sm"
                >
                  Parse / Validate ABI
                </button>
              </Panel>
              <Panel>
                <h3 className="text-sm font-medium">Validation output</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {(diagnostics.length ? diagnostics : ["No validation run yet"]).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </Panel>
            </section>
          )}

          {activeTab === "Functions" && (
            <section className="space-y-4">
              <Panel>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">Function catalog</h3>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    placeholder="Search signatures"
                  />
                </div>
                <div className="mt-3 max-h-[480px] space-y-2 overflow-auto pr-1">
                  {filteredFns.map((fn) => {
                    const selected = selectedSignatures.has(fn.signature);
                    return (
                      <div
                        key={fn.selectorTag}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-mono text-sm text-slate-100">{fn.signature}</div>
                            <div className="text-xs text-slate-400">selector hint {fn.canonicalSelectorHint}</div>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-xs ${badge(fn.kind)}`}>
                            {fn.kind}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFunction(fn.signature)}
                          disabled={abi.errors.length > 0}
                          className="mt-2 rounded-lg border border-slate-700 px-3 py-1 text-xs disabled:opacity-40"
                        >
                          {selected ? "Deselect" : "Select"}
                        </button>
                      </div>
                    );
                  })}
                  {abi.errors.length > 0 && <p className="text-red-300">Fix ABI errors before selection.</p>}
                </div>
              </Panel>

              <Panel>
                <h3 className="text-sm font-medium">Selected function metadata / ordering</h3>
                <div className="mt-3 space-y-3">
                  {[...config.selectedFunctions]
                    .sort((a, b) => a.order - b.order)
                    .map((fn) => (
                      <div
                        key={fn.signature}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="font-mono text-xs">{fn.signature}</div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="rounded border border-slate-700 px-2 py-1 text-xs"
                              onClick={() => reorder(fn.signature, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-700 px-2 py-1 text-xs"
                              onClick={() => reorder(fn.signature, 1)}
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <LabeledInput
                            label="Custom label"
                            value={fn.customLabel ?? ""}
                            onChange={(value) => updateSelectedMeta(fn.signature, "customLabel", value)}
                          />
                          <LabeledInput
                            label="Description"
                            value={fn.description ?? ""}
                            onChange={(value) => updateSelectedMeta(fn.signature, "description", value)}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </Panel>
            </section>
          )}

          {activeTab === "Workflows" && (
            <section className="space-y-4">
              {config.workflows.map((workflow) => (
                <Panel key={workflow.name}>
                  <h3 className="font-medium">{workflow.name}</h3>
                  <p className="text-xs text-slate-400">
                    Multi-step execution is best-effort and can partially complete.
                  </p>
                  <div className="mt-3 space-y-3">
                    {workflow.steps.map((step) => (
                      <div
                        key={step.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm"
                      >
                        <div className="font-mono text-xs text-slate-400">{step.id}</div>
                        <div className="mt-1 grid gap-2 md:grid-cols-2">
                          <label
                            className="text-xs text-slate-300"
                            htmlFor={`${workflow.name}-${step.id}-signature`}
                          >
                            Signature
                            {(() => {
                              const signatures = config.selectedFunctions.map((fn) => fn.signature);
                              const hasCurrent = signatures.includes(step.signature);
                              const selectValue = hasCurrent
                                ? step.signature
                                : signatures.length === 0
                                  ? "__none"
                                  : "__missing";
                              return (
                            <select
                              id={`${workflow.name}-${step.id}-signature`}
                              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2"
                              value={selectValue}
                              onChange={(event) =>
                                event.target.value !== "__none" &&
                                event.target.value !== "__missing" &&
                                updateWorkflowStep(workflow.name, step.id, {
                                  signature: event.target.value,
                                })
                              }
                            >
                              {signatures.length === 0 && (
                                <option value="__none">No selected functions available</option>
                              )}
                              {!hasCurrent && signatures.length > 0 && (
                                <option value="__missing">Missing: {step.signature}</option>
                              )}
                              {config.selectedFunctions.map((fn) => (
                                <option key={fn.signature} value={fn.signature}>
                                  {fn.signature}
                                </option>
                              ))}
                            </select>
                              );
                            })()}
                          </label>
                          <label
                            className="text-xs text-slate-300"
                            htmlFor={`${workflow.name}-${step.id}-condition`}
                          >
                            Condition
                            <select
                              id={`${workflow.name}-${step.id}-condition`}
                              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2"
                              value={step.condition}
                              onChange={(event) =>
                                updateWorkflowStep(workflow.name, step.id, {
                                  condition: event.target.value,
                                })
                              }
                            >
                              <option value="always">always</option>
                              <option value="previousStepSucceeded">previousStepSucceeded</option>
                              <option value="previousStepFailed">previousStepFailed</option>
                            </select>
                          </label>
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-3">
                          <LabeledInput
                            label="Retries"
                            value={`${step.retryAttempts}`}
                            onChange={(value) =>
                              updateWorkflowStep(workflow.name, step.id, {
                                retryAttempts: clampInt(value, 0, 10),
                              })
                            }
                            type="number"
                          />
                          <LabeledInput
                            label="Backoff (ms)"
                            value={`${step.backoffMs}`}
                            onChange={(value) =>
                              updateWorkflowStep(workflow.name, step.id, {
                                backoffMs: clampInt(value, 0, 60000),
                              })
                            }
                            type="number"
                          />
                          <label
                            className="text-xs text-slate-300"
                            htmlFor={`${workflow.name}-${step.id}-fallback`}
                          >
                            Fallback
                            <select
                              id={`${workflow.name}-${step.id}-fallback`}
                              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2"
                              value={step.fallback}
                              onChange={(event) =>
                                updateWorkflowStep(workflow.name, step.id, {
                                  fallback: event.target.value,
                                })
                              }
                            >
                              <option value="abort">abort</option>
                              <option value="continueNext">continueNext</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              ))}
            </section>
          )}

          {activeTab === "Appearance" && (
            <section className="space-y-4">
              <Panel>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-sm text-slate-300">
                    Theme
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                      value={config.ui.theme}
                      onChange={(event) =>
                        setConfig({
                          ...config,
                          ui: { ...config.ui, theme: event.target.value as ProjectConfig["ui"]["theme"] },
                        })
                      }
                    >
                      <option value="dark">dark</option>
                      <option value="midnight">midnight</option>
                      <option value="neon">neon</option>
                    </select>
                  </label>
                  <label className="text-sm text-slate-300">
                    Layout
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                      value={config.ui.layout}
                      onChange={(event) =>
                        setConfig({
                          ...config,
                          ui: { ...config.ui, layout: event.target.value as ProjectConfig["ui"]["layout"] },
                        })
                      }
                    >
                      <option value="stack">stack</option>
                      <option value="grid">grid</option>
                    </select>
                  </label>
                  <LabeledInput
                    label="Wallet button label"
                    value={config.ui.walletButtonLabel}
                    onChange={(value) =>
                      setConfig({ ...config, ui: { ...config.ui, walletButtonLabel: value } })
                    }
                  />
                </div>
              </Panel>
            </section>
          )}

          {activeTab === "Compile/Export" && (
            <section className="space-y-4">
              <Panel>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={compile}
                    className="rounded-lg border border-indigo-500 bg-indigo-500/20 px-4 py-2 text-sm"
                  >
                    Compile Project
                  </button>
                  <button
                    type="button"
                    onClick={downloadScript}
                    disabled={!compileResult?.script}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm disabled:opacity-40"
                  >
                    Download script.js
                  </button>
                </div>
                <div className="mt-3 text-xs text-slate-300">
                  <div>Output hash: {compileResult?.hash ?? "N/A"}</div>
                  <div>
                    Diagnostics: {compileResult?.diagnostics.length ?? 0} (errors:
                    {compileResult?.diagnostics.filter((d) => d.level === "error").length ?? 0})
                  </div>
                </div>
              </Panel>

              <Panel>
                <h3 className="text-sm font-medium">Diagnostics</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {(compileResult?.diagnostics.length
                    ? compileResult.diagnostics.map((d) => `${d.level.toUpperCase()}: ${d.message}`)
                    : ["Compile to view diagnostics"]
                  ).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </Panel>

              <Panel>
                <h3 className="text-sm font-medium">Manifest preview</h3>
                <pre className="mt-2 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs">
                  {JSON.stringify(compileResult?.manifest ?? {}, null, 2)}
                </pre>
              </Panel>

              <Panel>
                <h3 className="text-sm font-medium">Generated script.js preview</h3>
                <pre className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-[11px] leading-5">
                  {compileResult?.script || "Compile to preview generated script.js"}
                </pre>
              </Panel>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-2 text-sm text-slate-100">{value}</div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">{children}</div>;
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="text-xs text-slate-300">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
      />
    </label>
  );
}
