# THE-END Control Plane

Operational private control plane for compiling selected smart-contract ABI functions, transaction strategies, and UI/runtime configuration into a standalone browser JavaScript payload: `script.js`.

## Product boundary

- **Private dashboard (this repo runtime):** operator-facing config, validation, workflow setup, compilation, preview/export.
- **Public generated client (`script.js`):** standalone browser payload that runs through an end user's EIP-1193 wallet (`window.ethereum`).

The generated script does **not** require access to this dashboard at runtime.

## Features in this vertical slice

- Strict project schema validation with Zod.
- ABI parsing and normalization:
  - read/write/payable classification
  - overload disambiguation by canonical signatures
  - tuple/array recursive modeling
  - selector metadata hinting
  - malformed ABI errors
- Function selection + ordering + label/description editing.
- Workflow model with ordered steps:
  - `always`, `previousStepSucceeded`, `previousStepFailed`
  - retries + deterministic backoff
  - fallback `abort` / `continueNext`
  - selected-function + required-argument validation
- Deterministic compiler API:
  - `compileProject(config): string`
  - stable serialization
  - stable output hash
  - compile diagnostics (errors/warnings)
  - embedded manifest and runtime/compiler versions
- Standalone generated `script.js`:
  - no `import`/`require`
  - shadow-DOM runtime shell
  - canonical compiled modal design (`ui.modalDesign`)
  - EIP-1193 wallet connect + chain switch attempt
  - provider chooser with injected / WalletConnect v2 / Reown AppKit modes
  - `eth_call` read execution
  - transaction submit for write/payable (`eth_sendTransaction`)
  - tx hash + receipt polling
  - generated runtime UI (wallet modal + function cards + workflow controls + status)
  - workflow execution method (best-effort, non-atomic)
- Local browser persistence + sample ERC-20-like starter project.

## Security boundary

- No private-key custody.
- No backend signer.
- No secrets are embedded by design in generated script.
- Runtime signing is performed by user wallet via EIP-1193.

## Local setup

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Test and quality commands

```bash
npm run lint
npm run test
npm run build
```

## Manual smoke path

1. Start dev server: `npm run dev`
2. Open dashboard (sample project is preloaded).
3. Go to **Contract/ABI** and click **Parse / Validate ABI**.
4. Go to **Functions**, select at least one read function and one write/payable function.
5. Go to **Workflows**, verify step signatures/conditions/retry/fallback settings.
6. Go to **Compile/Export**, click **Compile Project**.
7. Confirm diagnostics are clean and hash is shown.
8. Click **Download script.js**.
9. Use in plain HTML:

```html
<div id="app"></div>
<script src="script.js"></script>
```

## Compiler API

- `compileProject(config): string`
- `compileProjectDetailed(config): { script, hash, manifest, diagnostics }`

Located in: `/lib/compiler.ts`

## Generated payload format (high level)

`script.js` contains:

- embedded manifest + normalized config subset
- embedded `window.__PROJECT_CONFIG__` runtime config
- selected ABI subset
- runtime codec/helpers
- wallet and execution engine
- modal renderer consuming compiled design schema
- workflow runner (`bestEffort: true` result semantics)

## Modal Studio (Forge-native)

- Canonical `modal.design` schema with backward-compatible defaults.
- Layouts: `list`, `grid`, `compact`, `securePanel`.
- Theme/typography/density/dimensions/radius/backdrop-blur/scoped colors.
- Copy fields: eyebrow, title, description, safety copy, search, empty/help text.
- Controls: trigger mode (`button`/`selector`/`programmatic`) and selector targeting.
- Provider options and ordering for:
  - `injected`
  - `walletconnectV2`
  - `reownAppKit`
- Sandboxed preview in dashboard uses the exact generated script runtime.

### WalletConnect v2 / Reown AppKit integration notes

- Generated runtime contains hooks for WalletConnect v2 and Reown AppKit provider modes.
- Runtime expects host page integrations on `window` (`window.WalletConnectProvider`, `window.ReownAppKit` or `window.reown`) when those modes are selected.
- The compiled script remains standalone (no import/require), so host pages can choose how to load those SDKs.

## Known limitations (explicit)

- Runtime ABI codec covers common Solidity types used in this slice (address, bool, int/uint, bytes/string, arrays, tuples) but is not a full replacement for mature audited ABI libraries.
- Function selectors are computed at compile time using Keccak-256 and embedded in the generated payload.
- Workflow execution is best-effort sequential and can partially complete; there is no cross-transaction atomicity.
- No backend multi-project storage/auth yet (local browser persistence only in this slice).
- WalletConnect/Reown modes require their browser SDK globals to be present on the host page.
