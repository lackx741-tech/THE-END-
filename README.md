# THE-END-

THE-END- is a private operator dashboard that compiles contract configuration into a standalone public `script.js` artifact. The dashboard is **not** user-facing. End users only receive the generated runtime, which renders inline controls, collects arguments, builds EIP-712 payloads locally, asks the wallet to sign with `eth_signTypedData_v4`, and sends signed payloads to backend `/sign` and `/execute` endpoints.

## Architecture

### Part 1 — private operator control plane
Built with Next.js + Tailwind and lightweight local shadcn-style UI primitives.

Capabilities in this initial vertical slice:
- create/load a project configuration JSON
- paste or upload ABI JSON
- parse ABI and classify read/write/payable functions
- preserve overloads, tuples, and arrays
- select public functions, reorder them, and customize labels/defaults
- define backend endpoint URLs
- edit workflow JSON with retry, fallback, and previous-step bindings
- compile deterministic standalone `script.js`
- preview and download generated output

### Part 2 — generated public runtime
The compiler emits a single self-contained JavaScript file that:
- contains selected ABI function metadata
- renders inline buttons/forms for selected functions
- builds EIP-712 typed data locally in the browser
- calls `window.ethereum.request({ method: 'eth_signTypedData_v4', ... })`
- POSTs signatures and typed payloads to `/sign`
- POSTs execution payloads to `/execute`
- displays results and errors inline
- runs configured sequential workflows with retry/fallback behavior
- avoids `import` / `require` statements

## Security boundary

- **Dashboard:** private operator tooling only
- **Generated script:** public runtime only
- **Backend:** verifies EIP-712 signatures and executes/relays transactions

This repository does **not** implement backend signing or execution. It only generates the client artifact expected to call:

- `POST /sign`
- `POST /execute`
- optional `GET /config/:projectId`

No private keys or client-side signing libraries are added. The browser runtime only uses `window.ethereum.request()` for EIP-712 signing.

## Local setup

Use Node.js 20.9.0 or newer.

```bash
npm install
THE_END_ENABLE_OPERATOR_DASHBOARD=true npm run dev
```

Open `http://localhost:3000`.

The operator dashboard route stays disabled unless `THE_END_ENABLE_OPERATOR_DASHBOARD` is explicitly set, which keeps the control plane behind a deployment-time private boundary by default.

## Commands

```bash
npm test
npm run lint
npm run build
```

## Generated runtime contract with the backend

### `/sign`
The generated runtime posts:

```json
{
  "signature": "0x...",
  "account": "0x...",
  "typedData": { "domain": {}, "types": {}, "primaryType": "...", "message": {} },
  "functionName": "transfer",
  "functionSignature": "transfer(address,uint256)",
  "args": { "recipient": "0x...", "amount": "100" }
}
```

### `/execute`
The generated runtime posts either `signResult.executePayload` from the backend response or a fallback payload containing the signature, typed data, function metadata, args, and `/sign` response.

## EIP-712 payload shape

For each selected function the compiler generates:
- `domain` from dashboard config
- unique `primaryType` per function signature (including overload-safe differentiation)
- `types.EIP712Domain`
- `types[primaryType]` with `projectName`, `functionSignature`, and ABI-derived inputs
- nested typed-data structs for tuple parameters

## Example project

A bundled ERC-20 sample is included and loads by default. It demonstrates:
- read + write functions
- overload handling
- arrays and tuples
- workflow configuration with retry/fallback

## Tests included

- ABI parser tests
- EIP-712 type generation tests
- configuration validation tests
- deterministic compilation tests
- generated script structure validation

## Known limitations / future work

- workflow editing is JSON-first in this vertical slice rather than a full visual builder
- generated runtime assumes backend responses are JSON
- tuple/array inputs in the runtime are entered as JSON text
- backend response semantics beyond `/sign` and `/execute` payload shape remain operator-defined
