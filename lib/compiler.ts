import { parseAndNormalizeAbi, type NormalizedFunction } from "@/lib/abi";
import {
  projectConfigSchema,
  type ProjectConfig,
  type SelectedFunctionConfig,
} from "@/lib/schema";
import { hashString, stableStringify } from "@/lib/stable";
import { validateWorkflows } from "@/lib/workflow";

const COMPILER_VERSION = "1.0.0";
const RUNTIME_VERSION = "1.0.0";

export type CompileDiagnostic = {
  level: "error" | "warning";
  message: string;
};

export type CompileOutput = {
  script: string;
  hash: string;
  manifest: Record<string, unknown>;
  diagnostics: CompileDiagnostic[];
};

function pickFunctions(
  normalized: NormalizedFunction[],
  selected: SelectedFunctionConfig[],
): NormalizedFunction[] {
  const bySignature = new Map(normalized.map((fn) => [fn.signature, fn]));
  const sortedSelected = [...selected].sort((a, b) => a.order - b.order);
  return sortedSelected
    .map((selection) => bySignature.get(selection.signature))
    .filter(Boolean) as NormalizedFunction[];
}

function buildSelectedAbi(rawAbiJson: string, signatures: Set<string>): unknown[] {
  const abi = JSON.parse(rawAbiJson) as Array<Record<string, unknown>>;
  const canonicalType = (input: { type?: string; components?: unknown[] }): string => {
    const type = String(input.type ?? "");
    const arrayMatch = type.match(/(.*?)(\[[^\]]*\])*$/);
    const base = arrayMatch?.[1] ?? type;
    const suffix = type.slice(base.length);
    if (base !== "tuple") return type;
    const components = Array.isArray(input.components)
      ? input.components.map((component) =>
          canonicalType(component as { type?: string; components?: unknown[] }),
        )
      : [];
    return `(${components.join(",")})${suffix}`;
  };
  return abi.filter((entry) => {
    if (entry.type !== "function" || typeof entry.name !== "string") return false;
    const inputs = Array.isArray(entry.inputs)
      ? entry.inputs.map((input) =>
          canonicalType(input as { type?: string; components?: unknown[] }),
        )
      : [];
    const signature = `${entry.name}(${inputs.join(",")})`;
    return signatures.has(signature);
  });
}

function createRuntimeSource(payload: Record<string, unknown>): string {
  const payloadJson = stableStringify(payload);
  return `;(function(){\n"use strict";\nconst PAYLOAD=${payloadJson};\nconst RUNTIME_VERSION="${RUNTIME_VERSION}";\n
function hexPad(value, bytes){const v=value.replace(/^0x/,"");return v.padStart(bytes*2,"0");}
function toHexBytes(bytes){return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");}
function isHex(v){return typeof v==="string"&&/^0x[0-9a-fA-F]*$/.test(v);}
function isTupleType(type){return type==="tuple"||type.startsWith("(");}
function parseArray(type){const m=type.match(/^(.*)\\[(.*?)\\]$/);if(!m) return null;return {inner:m[1],len:m[2]===""?null:Number(m[2])};}
function baseType(type){let t=type;while(parseArray(t)){t=parseArray(t).inner;}return t;}
function isDynamic(param){const arr=parseArray(param.type);if(arr){if(arr.len===null) return true;return isDynamic({...param,type:arr.inner});}
if(param.type==="string"||param.type==="bytes") return true;
if(isTupleType(param.type)){return (param.components||[]).some(c=>isDynamic(c));}
return false;}
function staticSize(param){const arr=parseArray(param.type);if(arr){if(arr.len===null) return 32;const inner={...param,type:arr.inner};if(isDynamic(inner)) return 32;return arr.len*staticSize(inner);}if(isDynamic(param)) return 32;if(isTupleType(param.type)){return (param.components||[]).reduce((s,c)=>s+staticSize(c),0);}return 32;}
function parseIntValue(v){if(typeof v==="bigint") return v; if(typeof v==="number") return BigInt(v); if(typeof v==="string"){if(v.startsWith("0x")||v.startsWith("-0x")) return BigInt(v); return BigInt(v);} throw new Error("Invalid integer value");}
function twosComplement(value){const bits=256n;const max=1n<<bits;return value<0 ? max+value : value;}
function encodeUint(value){let n=parseIntValue(value);if(n<0n) throw new Error("Unsigned integer cannot be negative");return hexPad(n.toString(16),32);}
function encodeInt(value){const n=parseIntValue(value);const encoded=twosComplement(n);return hexPad(encoded.toString(16),32);}
function encodeBool(value){return hexPad(value?"1":"0",32);}
function encodeAddress(value){if(typeof value!=="string"||!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error("Invalid address");return hexPad(value.toLowerCase().slice(2),32);}
function encodeFixedBytes(type,value){const size=Number(type.replace("bytes",""));if(!isHex(value)) throw new Error("Fixed bytes expects hex");const body=value.slice(2);if(body.length!==size*2) throw new Error("Invalid fixed bytes length");return body.padEnd(64,"0");}
function encodeDynamicBytes(hex){if(!isHex(hex)) throw new Error("bytes expects hex string");const body=hex.slice(2);const len=body.length/2;const padding=(32-(len%32||32))*2;return encodeUint(len)+body+"0".repeat(padding<0?0:padding);}
function encodeString(value){const bytes=new TextEncoder().encode(String(value));const body=toHexBytes(bytes);const len=bytes.length;const padding=(32-(len%32||32))*2;return encodeUint(len)+body+"0".repeat(padding<0?0:padding);}
function splitTupleValues(value,components){if(Array.isArray(value)) return value;if(value&&typeof value==="object") return components.map(c=>value[c.name]);throw new Error("Tuple expects array/object");}
function encodeType(param,value){const arr=parseArray(param.type);if(arr){const list=Array.isArray(value)?value:[];if(arr.len!==null&&list.length!==arr.len) throw new Error("Fixed array length mismatch");const inner={...param,type:arr.inner};if(arr.len===null){const encoded=encodeParams(Array.from({length:list.length},()=>inner),list);return {dynamic:true,data:encodeUint(list.length)+encoded};}
const encoded=encodeParams(Array.from({length:list.length},()=>inner),list);if(isDynamic(inner)){return {dynamic:true,data:encoded};}
return {dynamic:false,data:encoded};}
if(isTupleType(param.type)){const components=param.components||[];const tupleValues=splitTupleValues(value,components);const encoded=encodeParams(components,tupleValues);if(components.some(c=>isDynamic(c))){return {dynamic:true,data:encoded};}return {dynamic:false,data:encoded};}
if(param.type==="address") return {dynamic:false,data:encodeAddress(value)};
if(param.type==="bool") return {dynamic:false,data:encodeBool(Boolean(value))};
if(/^uint(\\d+)?$/.test(param.type)) return {dynamic:false,data:encodeUint(value)};
if(/^int(\\d+)?$/.test(param.type)) return {dynamic:false,data:encodeInt(value)};
if(param.type==="string") return {dynamic:true,data:encodeString(value)};
if(param.type==="bytes") return {dynamic:true,data:encodeDynamicBytes(String(value||"0x"))};
if(/^bytes([1-9]|[12]\\d|3[0-2])$/.test(param.type)) return {dynamic:false,data:encodeFixedBytes(param.type,String(value||"0x"))};
throw new Error("Unsupported ABI type in runtime: "+param.type);
}
function encodeParams(params,values){const encoded=params.map((param,i)=>encodeType(param,values[i]));const headSize=params.reduce((sum,param,idx)=>sum+(encoded[idx].dynamic?32:staticSize(param)),0);let head="";let tail="";let tailOffset=headSize;for(let i=0;i<params.length;i++){if(encoded[i].dynamic){head+=encodeUint(tailOffset);tail+=encoded[i].data;tailOffset+=encoded[i].data.length/2;}else{head+=encoded[i].data;}}
return head+tail;}
function hexToBigInt(word){return BigInt("0x"+word);}
function readWord(data,offsetBytes){const start=offsetBytes*2;return data.slice(start,start+64);} 
function decodeType(param,data,offsetBytes){const arr=parseArray(param.type);if(arr){if(arr.len===null){const loc=Number(hexToBigInt(readWord(data,offsetBytes)));const len=Number(hexToBigInt(readWord(data,loc)));const inner={...param,type:arr.inner};const values=[];const base=loc+32;const step=isDynamic(inner)?32:staticSize(inner);for(let i=0;i<len;i++){values.push(decodeType(inner,data,base+i*step));}return values;}const inner={...param,type:arr.inner};if(isDynamic(inner)){const loc=Number(hexToBigInt(readWord(data,offsetBytes)));const values=[];for(let i=0;i<arr.len;i++){values.push(decodeType(inner,data,loc+i*32));}return values;}const values=[];for(let i=0;i<arr.len;i++){values.push(decodeType(inner,data,offsetBytes+i*staticSize(inner)));}return values;}
if(isTupleType(param.type)){const comps=param.components||[];if(comps.some(c=>isDynamic(c))){const loc=Number(hexToBigInt(readWord(data,offsetBytes)));return decodeTuple(comps,data,loc);}return decodeTuple(comps,data,offsetBytes);}const word=readWord(data,offsetBytes);if(param.type==="address") return "0x"+word.slice(24);
if(param.type==="bool") return hexToBigInt(word)!==0n;
if(/^uint(\\d+)?$/.test(param.type)) return hexToBigInt(word).toString();
if(/^int(\\d+)?$/.test(param.type)){const widthMatch=param.type.match(/^int(\\d+)?$/);const bits=BigInt(widthMatch&&widthMatch[1]?widthMatch[1]:"256");const mask=(1n<<bits)-1n;let value=hexToBigInt(word)&mask;const signBit=1n<<(bits-1n);if(value>=signBit){value=value-(1n<<bits);}return value.toString();}
if(param.type==="bytes"){const loc=Number(hexToBigInt(readWord(data,offsetBytes)));const len=Number(hexToBigInt(readWord(data,loc)));const start=(loc+32)*2;return "0x"+data.slice(start,start+len*2);} 
if(param.type==="string"){const loc=Number(hexToBigInt(readWord(data,offsetBytes)));const len=Number(hexToBigInt(readWord(data,loc)));const start=(loc+32)*2;const hex=data.slice(start,start+len*2);const arrBytes=new Uint8Array(hex.match(/.{1,2}/g)?.map(b=>parseInt(b,16))||[]);return new TextDecoder().decode(arrBytes);} 
if(/^bytes([1-9]|[12]\\d|3[0-2])$/.test(param.type)){const size=Number(param.type.replace("bytes",""));return "0x"+word.slice(0,size*2);}return "0x"+word;}
function decodeTuple(components,data,base){const out=[];let cursor=base;for(const c of components){out.push(decodeType(c,data,cursor));cursor+=isDynamic(c)?32:staticSize(c);}return out;}
async function getProvider(){const provider=window.ethereum;if(!provider) throw new Error("EIP-1193 provider not found");return provider;}
async function ensureChain(provider,chainId){const current=await provider.request({method:"eth_chainId"});const target="0x"+BigInt(chainId).toString(16);if(String(current).toLowerCase()===target.toLowerCase()) return;try{await provider.request({method:"wallet_switchEthereumChain",params:[{chainId:target}]});}catch(error){throw new Error("Wrong-chain or switch failed: "+(error&&error.message?error.message:String(error)));}}
function mountRoot(selectorValue){const root=document.querySelector(selectorValue)||document.body;return root;}
function inputForParam(param,defaultValue){const wrap=document.createElement("div");wrap.className="tx-field";const label=document.createElement("label");label.textContent=param.label||param.name||param.type;const input=document.createElement("input");input.value=defaultValue||"";input.placeholder=param.type;input.dataset.paramType=param.type;input.className="tx-input";wrap.appendChild(label);wrap.appendChild(input);return {wrap,input};}
function injectStyles(){if(document.getElementById("tx-client-style")) return;const style=document.createElement("style");style.id="tx-client-style";style.textContent='.tx-shell{font-family:Inter,system-ui,sans-serif;background:#070b14;color:#e6ecff;padding:16px;border-radius:16px;border:1px solid #1f2b44}.tx-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.tx-card{background:#0d1423;border:1px solid #203050;padding:12px;margin-top:12px;border-radius:12px}.tx-field{display:flex;flex-direction:column;gap:4px;margin:8px 0}.tx-input, .tx-button, .tx-select{background:#0a1020;color:#f4f7ff;border:1px solid #2a3b63;padding:8px;border-radius:8px}.tx-button{cursor:pointer}.tx-status{white-space:pre-wrap;background:#04070f;border:1px solid #19253f;padding:10px;border-radius:8px;margin-top:10px;}';document.head.appendChild(style);}
function parseValueForType(type,input){const arr=parseArray(type);if(arr){if(isTupleType(arr.inner)){try{return JSON.parse(input);}catch{throw new Error("Tuple array input for "+type+" must be valid JSON");}}try{return JSON.parse(input);}catch{throw new Error("Array input for "+type+" must be valid JSON");}}if(isTupleType(type)){try{return JSON.parse(input);}catch{throw new Error("Tuple input for "+type+" must be valid JSON");}}if(/^u?int(\\d+)?$/.test(type)) return input||"0";if(type==="bool") return input==="true"||input==="1";if(type==="address") return input; if(type==="bytes"||/^bytes([1-9]|[12]\\d|3[0-2])$/.test(type)) return input||"0x"; return input;}

function buildClient(payload){const state={provider:null,account:null,lastStepSucceeded:null,stepResults:[]};
const api={
  async connect(){state.provider=await getProvider();await ensureChain(state.provider,payload.config.chainId);const accounts=await state.provider.request({method:"eth_requestAccounts"});state.account=accounts[0]||null;return state.account;},
  async executeRead(fn,args){if(!state.provider) await api.connect();const method=fn.selector;const encoded=encodeParams(fn.inputs,args).replace(/^0x/,"");const data=method+encoded;const raw=await state.provider.request({method:"eth_call",params:[{to:payload.config.contractAddress,data},"latest"]});const clean=String(raw).replace(/^0x/,"");const decoded=fn.outputs.length?fn.outputs.map((out,idx)=>decodeType(out,clean,idx*32)):[];return {raw,decoded};},
  async executeWrite(fn,args,extra){if(!state.provider) await api.connect();const method=fn.selector;const encoded=encodeParams(fn.inputs,args).replace(/^0x/,"");const tx={from:state.account,to:payload.config.contractAddress,data:method+encoded};if(extra&&extra.value!==undefined&&extra.value!==null) tx.value=extra.value;if(extra&&extra.gas!==undefined&&extra.gas!==null) tx.gas=extra.gas;if(extra&&extra.maxFeePerGas!==undefined&&extra.maxFeePerGas!==null) tx.maxFeePerGas=extra.maxFeePerGas;if(extra&&extra.maxPriorityFeePerGas!==undefined&&extra.maxPriorityFeePerGas!==null) tx.maxPriorityFeePerGas=extra.maxPriorityFeePerGas;const hash=await state.provider.request({method:"eth_sendTransaction",params:[tx]});let receipt=null;for(let i=0;i<120;i++){receipt=await state.provider.request({method:"eth_getTransactionReceipt",params:[hash]});if(receipt) break; await new Promise(r=>setTimeout(r,2000));}return {hash,receipt};},
  async executeWorkflow(name,argMap){const wf=payload.config.workflows.find(w=>w.name===name);if(!wf) throw new Error("Workflow not found");const results=[];let prevOk=null;for(const step of wf.steps){if(step.condition==="previousStepSucceeded"&&prevOk!==true) continue;if(step.condition==="previousStepFailed"&&prevOk!==false) continue;const fn=payload.functions.find(f=>f.signature===step.signature);if(!fn) throw new Error("Missing function for workflow step: "+step.signature);const args=(argMap&&argMap[step.signature])||[];let ok=false;let attempts=0;let lastErr=null;while(attempts<=step.retryAttempts&&!ok){try{const action=fn.kind==="read"? await api.executeRead(fn,args):await api.executeWrite(fn,args,{});results.push({step:step.id,signature:step.signature,ok:true,action});ok=true;}catch(e){lastErr=e;attempts++;if(attempts<=step.retryAttempts&&step.backoffMs>0){await new Promise(r=>setTimeout(r,step.backoffMs));}}}
if(!ok){results.push({step:step.id,signature:step.signature,ok:false,error:lastErr?String(lastErr.message||lastErr):"unknown"});if(step.fallback==="abort") {prevOk=false;break;}prevOk=false;continue;}prevOk=true;}
state.stepResults=results;state.lastStepSucceeded=prevOk;return {bestEffort:true,results};}
};
return api;
}

function render(payload){injectStyles();const root=mountRoot(payload.config.ui.mountSelector||"#app");root.innerHTML="";const shell=document.createElement("div");shell.className="tx-shell";const status=document.createElement("div");status.className="tx-status";status.textContent="Ready";const client=buildClient(payload);
const top=document.createElement("div");top.className="tx-row";const connect=document.createElement("button");connect.className="tx-button";connect.textContent=payload.config.ui.walletButtonLabel||"Connect Wallet";connect.onclick=async()=>{try{const account=await client.connect();status.textContent="Connected: "+account;}catch(error){status.textContent="Connection error: "+String(error.message||error);}};top.appendChild(connect);shell.appendChild(top);
for(const fn of payload.functions){const card=document.createElement("div");card.className="tx-card";const h=document.createElement("h3");h.textContent=(fn.customLabel||fn.name)+" ["+fn.kind+"]";card.appendChild(h);if(fn.description){const p=document.createElement("p");p.textContent=fn.description;card.appendChild(p);}const controls=[];for(const input of fn.inputs){const field=inputForParam(input,input.defaultValue||"");controls.push(field);card.appendChild(field.wrap);}let valueInput=null;if(fn.kind==="payable"){const field=inputForParam({label:"Transaction value (wei)",name:"value",type:"uint256"},"");valueInput=field.input;card.appendChild(field.wrap);}const button=document.createElement("button");button.className="tx-button";button.textContent=fn.kind==="read"?"Read":"Send Transaction";button.onclick=async()=>{try{const args=controls.map(c=>parseValueForType(c.input.dataset.paramType,c.input.value));if(fn.kind==="read"){const out=await client.executeRead(fn,args);status.textContent="Read success\\n"+JSON.stringify(out,null,2);}else{const out=await client.executeWrite(fn,args,{value:valueInput?valueInput.value:undefined,gas:payload.config.txStrategy.defaultGasLimit,maxFeePerGas:payload.config.txStrategy.defaultMaxFeePerGas,maxPriorityFeePerGas:payload.config.txStrategy.defaultMaxPriorityFeePerGas});status.textContent="Tx submitted\\n"+JSON.stringify(out,null,2);} }catch(error){status.textContent="Execution error: "+String(error.message||error);} };
card.appendChild(button);shell.appendChild(card);} 
if(payload.config.workflows.length){const wfBox=document.createElement("div");wfBox.className="tx-card";const select=document.createElement("select");select.className="tx-select";payload.config.workflows.forEach(w=>{const o=document.createElement("option");o.value=w.name;o.textContent=w.name;select.appendChild(o);});const run=document.createElement("button");run.className="tx-button";run.textContent="Run Workflow";run.onclick=async()=>{try{const out=await client.executeWorkflow(select.value,{});status.textContent="Workflow finished (best-effort)\\n"+JSON.stringify(out,null,2);}catch(error){status.textContent="Workflow error: "+String(error.message||error);}};wfBox.appendChild(select);wfBox.appendChild(run);shell.appendChild(wfBox);}shell.appendChild(status);root.appendChild(shell);window.EndTxClient={payload,client};}

render(PAYLOAD);
})();\n`;
}

function mapUiForRuntime(
  fn: NormalizedFunction,
  selection: SelectedFunctionConfig,
): Record<string, unknown> {
  return {
    name: fn.name,
    signature: fn.signature,
    selector: fn.canonicalSelectorHint,
    kind: fn.kind,
    customLabel: selection.customLabel,
    description: selection.description,
    inputs: fn.inputs.map((input, index) => ({
      name: input.name !== "arg" ? input.name : `arg${index}`,
      type: input.canonicalType,
      label: selection.arguments[input.name]?.label ?? input.name,
      defaultValue: selection.arguments[input.name]?.defaultValue,
      components: input.components?.map((c) => ({
        name: c.name,
        type: c.canonicalType,
      })),
    })),
    outputs: fn.outputs.map((output) => ({
      name: output.name,
      type: output.canonicalType,
      components: output.components,
    })),
  };
}

export function compileProject(config: ProjectConfig): string {
  return compileProjectDetailed(config).script;
}

export function compileProjectDetailed(rawConfig: unknown): CompileOutput {
  const diagnostics: CompileDiagnostic[] = [];
  const parsed = projectConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      diagnostics.push({
        level: "error",
        message: `${issue.path.join(".") || "config"}: ${issue.message}`,
      });
    }
    return {
      script: "",
      hash: "",
      manifest: {},
      diagnostics,
    };
  }

  const config = parsed.data;
  const abiResult = parseAndNormalizeAbi(config.rawAbiJson);
  abiResult.errors.forEach((error) => diagnostics.push({ level: "error", message: error }));

  const selectedFns = pickFunctions(abiResult.functions, config.selectedFunctions);
  if (selectedFns.length !== config.selectedFunctions.length) {
    diagnostics.push({
      level: "error",
      message: "Some selected functions are not present in the normalized ABI",
    });
  }

  const runtimeArgumentNames = new Map(
    selectedFns.map((fn) => [
      fn.signature,
      new Set(fn.inputs.map((input, idx) => (input.name === "arg" ? `arg${idx}` : input.name))),
    ]),
  );
  const workflowDiagnostics = validateWorkflows(config, runtimeArgumentNames);
  workflowDiagnostics.forEach((diag) => diagnostics.push(diag));

  if (diagnostics.some((d) => d.level === "error")) {
    return {
      script: "",
      hash: "",
      manifest: {},
      diagnostics,
    };
  }

  const selectedSet = new Set(config.selectedFunctions.map((fn) => fn.signature));
  const selectedAbi = buildSelectedAbi(config.rawAbiJson, selectedSet);

  const functionsForRuntime = config.selectedFunctions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((selection) => {
      const normalized = selectedFns.find((fn) => fn.signature === selection.signature)!;
      return mapUiForRuntime(normalized, selection);
    });

  const payload = {
    manifest: {
      compilerVersion: COMPILER_VERSION,
      runtimeVersion: RUNTIME_VERSION,
      projectName: config.projectName,
      projectVersion: config.version,
      selectedFunctionCount: functionsForRuntime.length,
      selectedSignatures: config.selectedFunctions
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((f) => f.signature),
      deterministicConfigHash: hashString(stableStringify(config)),
    },
    config: {
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
      contractAddress: config.contractAddress,
      ui: config.ui,
      txStrategy: config.txStrategy,
      workflows: config.workflows,
    },
    selectedAbi,
    functions: functionsForRuntime,
  };

  const script = createRuntimeSource(payload);
  const hash = hashString(script);
  return {
    script,
    hash,
    manifest: {
      ...payload.manifest,
      outputHash: hash,
    },
    diagnostics,
  };
}
