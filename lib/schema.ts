import { z } from "zod";

const cssColorString = z.string().min(1);

export const modalWalletProviderSchema = z.enum([
  "injected",
  "walletconnectV2",
  "reownAppKit",
]);

export const modalDesignSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  layout: z.enum(["list", "grid", "compact", "securePanel"]).default("securePanel"),
  theme: z.enum(["dark", "light"]).default("dark"),
  typography: z.enum(["system", "modern", "mono"]).default("modern"),
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  dimensions: z
    .object({
      width: z.number().int().min(320).max(960).default(520),
      maxHeight: z.number().int().min(320).max(900).default(760),
    })
    .default({ width: 520, maxHeight: 760 }),
  radius: z.number().int().min(0).max(32).default(16),
  backdropBlur: z.number().int().min(0).max(24).default(12),
  colors: z
    .object({
      accent: cssColorString.default("#6366f1"),
      surface: cssColorString.default("#0b1220"),
      text: cssColorString.default("#e2e8f0"),
      muted: cssColorString.default("#94a3b8"),
      danger: cssColorString.default("#ef4444"),
    })
    .default({
      accent: "#6366f1",
      surface: "#0b1220",
      text: "#e2e8f0",
      muted: "#94a3b8",
      danger: "#ef4444",
    }),
  copy: z
    .object({
      eyebrow: z.string().default("Secure Session"),
      title: z.string().default("Connect Wallet"),
      description: z.string().default("Select a wallet provider to continue."),
      safetyCopy: z.string().default("Never share your private key or seed phrase."),
      searchPlaceholder: z.string().default("Search wallet providers"),
      emptyState: z.string().default("No wallet providers match your search."),
      helpText: z.string().default("Need help? Verify network and wallet permissions."),
    })
    .default({
      eyebrow: "Secure Session",
      title: "Connect Wallet",
      description: "Select a wallet provider to continue.",
      safetyCopy: "Never share your private key or seed phrase.",
      searchPlaceholder: "Search wallet providers",
      emptyState: "No wallet providers match your search.",
      helpText: "Need help? Verify network and wallet permissions.",
    }),
  features: z
    .object({
      enableSearch: z.boolean().default(true),
      enableHelpPanel: z.boolean().default(true),
      showWalletDetails: z.boolean().default(true),
      showBranding: z.boolean().default(true),
      enableProviderSelection: z.boolean().default(true),
    })
    .default({
      enableSearch: true,
      enableHelpPanel: true,
      showWalletDetails: true,
      showBranding: true,
      enableProviderSelection: true,
    }),
  branding: z
    .object({
      productName: z.string().default("Forge Runtime"),
      subtitle: z.string().default("Operator configured secure wallet modal"),
    })
    .default({
      productName: "Forge Runtime",
      subtitle: "Operator configured secure wallet modal",
    }),
  provider: z
    .object({
      mode: z
        .enum(["auto", "injected", "walletconnectV2", "reownAppKit"])
        .default("auto"),
      order: z
        .array(modalWalletProviderSchema)
        .min(1)
        .default(["injected", "walletconnectV2", "reownAppKit"]),
      walletConnect: z
        .object({
          projectId: z.string().default(""),
          relayUrl: z.string().url().optional(),
        })
        .default({ projectId: "" }),
      reownAppKit: z
        .object({
          projectId: z.string().default(""),
          network: z.string().default("eip155"),
        })
        .default({ projectId: "", network: "eip155" }),
    })
    .default({
      mode: "auto",
      order: ["injected", "walletconnectV2", "reownAppKit"],
      walletConnect: { projectId: "" },
      reownAppKit: { projectId: "", network: "eip155" },
    }),
  controls: z
    .object({
      triggerMode: z.enum(["button", "selector", "programmatic"]).default("button"),
      triggerSelector: z.string().default(""),
      triggerLabel: z.string().default("Connect Wallet"),
    })
    .default({ triggerMode: "button", triggerSelector: "", triggerLabel: "Connect Wallet" }),
});

export const uiSettingsSchema = z.object({
  theme: z.enum(["dark", "midnight", "neon"]),
  layout: z.enum(["stack", "grid"]),
  walletButtonLabel: z.string().min(1),
  mountSelector: z.string().min(1).default("#app"),
  modalDesign: modalDesignSchema.optional(),
});

export const txStrategySchema = z.object({
  defaultGasLimit: z.string().optional(),
  defaultMaxFeePerGas: z.string().optional(),
  defaultMaxPriorityFeePerGas: z.string().optional(),
  globalAutomationEnabled: z.boolean().default(false),
});

export const argumentUiSchema = z.object({
  label: z.string().optional(),
  defaultValue: z.string().optional(),
});

export const selectedFunctionSchema = z.object({
  signature: z.string().min(1),
  customLabel: z.string().optional(),
  description: z.string().optional(),
  order: z.number().int().nonnegative(),
  arguments: z.record(z.string(), argumentUiSchema).default({}),
});

export const workflowStepSchema = z.object({
  id: z.string().min(1),
  signature: z.string().min(1),
  mode: z.enum(["manual", "automatic"]),
  condition: z.enum(["always", "previousStepSucceeded", "previousStepFailed"]),
  retryAttempts: z.number().int().min(0).max(10).default(0),
  backoffMs: z.number().int().min(0).max(60000).default(0),
  fallback: z.enum(["abort", "continueNext"]),
  requiredArguments: z.array(z.string()).default([]),
});

export const workflowSchema = z.object({
  name: z.string().min(1),
  steps: z.array(workflowStepSchema).default([]),
});

export const compilationMetaSchema = z.object({
  compilerVersion: z.string().default("1.0.0"),
  runtimeVersion: z.string().default("1.0.0"),
});

export const projectConfigSchema = z.object({
  projectName: z.string().min(1),
  version: z.string().min(1),
  chainId: z.union([
    z.number().int().positive(),
    z.string().regex(/^[1-9][0-9]*$/, "Chain ID must be a positive integer string"),
  ]),
  rpcUrl: z.string().url(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid contract address"),
  rawAbiJson: z.string().min(2),
  selectedFunctions: z.array(selectedFunctionSchema),
  ui: uiSettingsSchema,
  txStrategy: txStrategySchema,
  workflows: z.array(workflowSchema),
  compilation: compilationMetaSchema,
});

export type ModalDesign = z.infer<typeof modalDesignSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type SelectedFunctionConfig = z.infer<typeof selectedFunctionSchema>;
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
