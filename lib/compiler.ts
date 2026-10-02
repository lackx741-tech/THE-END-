import { parseAndNormalizeAbi, type NormalizedFunction } from "@/lib/abi";
import {
  projectConfigSchema,
  type ProjectConfig,
  type SelectedFunctionConfig,
} from "@/lib/schema";
import { hashString, stableStringify } from "@/lib/stable";
import { validateWorkflows } from "@/lib/workflow";
import { resolveModalDesign } from "@/lib/modal";

const COMPILER_VERSION = "1.1.0";
const RUNTIME_VERSION = "1.1.0";

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
  return `;(function(){\n"use strict";\nconst PAYLOAD=${payloadJson};\nconst RUNTIME_VERSION="${RUNTIME_VERSION}";\nwindow.__PROJECT_CONFIG__=PAYLOAD.config;\n
function hexPad(value, bytes){const v=value.replace(/^0x/,"");return v.padStart(bytes*2,"0");}
function toHexBytes(bytes){return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");}
function isHex(v){return typeof v==="string"&&/^0x[0-9a-fA-F]*$/.test(v);}
function isTupleType(type){return type==="tuple"||type.startsWith("(");}
function parseArray(type){const m=type.match(/^(.*)\\[(.*?)\\]$/);if(!m) return null;return {inner:m[1],len:m[2]===""?null:Number(m[2])};}
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
function encodeParams(params,values){const encoded=params.map((param,i)=>encodeType(param,values[i]));const headSize=params.reduce((sum,param,idx)=>sum+(encoded[idx].dynamic?32:staticSize(param)),0);let head="";let tail="";let tailOffset=headSize;for(let i=0;i<params.length;i++){if(encoded[i].dynamic){head+=encodeUint(tailOffset);tail+=encoded[i].data;tailOffset+=encoded[i].data.length/2;}else{head+=encoded[i].data;}}return head+tail;}
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
function decodeOutputs(outputs,data){const decoded=[];let cursor=0;for(const output of outputs){decoded.push(decodeType(output,data,cursor));cursor+=isDynamic(output)?32:staticSize(output);}return decoded;}
async function getProvider(){const provider=window.ethereum;if(!provider) throw new Error("EIP-1193 provider not found");return provider;}
async function ensureChain(provider,chainId){const current=await provider.request({method:"eth_chainId"});const target="0x"+BigInt(chainId).toString(16);if(String(current).toLowerCase()===target.toLowerCase()) return;try{await provider.request({method:"wallet_switchEthereumChain",params:[{chainId:target}]});}catch(error){throw new Error("Wrong-chain or switch failed: "+(error&&error.message?error.message:String(error)));}}
async function rpcRequest(rpcUrl,method,params){const response=await fetch(rpcUrl,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});if(!response.ok){throw new Error("RPC request failed: "+response.status);}const payload=await response.json();if(payload.error){throw new Error("RPC error: "+(payload.error.message||"unknown"));}return payload.result;}
function parseValueForType(type,input){const arr=parseArray(type);if(arr){if(isTupleType(arr.inner)){try{return JSON.parse(input);}catch{throw new Error("Tuple array input for "+type+" must be valid JSON");}}try{return JSON.parse(input);}catch{throw new Error("Array input for "+type+" must be valid JSON");}}if(isTupleType(type)){try{return JSON.parse(input);}catch{throw new Error("Tuple input for "+type+" must be valid JSON");}}if(/^u?int(\\d+)?$/.test(type)) return input||"0";if(type==="bool") return input==="true"||input==="1";if(type==="address") return input; if(type==="bytes"||/^bytes([1-9]|[12]\\d|3[0-2])$/.test(type)) return input||"0x"; return input;}
function mountRoot(selectorValue){return document.querySelector(selectorValue)||document.body;}

function toProviderItems(design){
  const labels={injected:"Browser Wallet",walletconnectV2:"WalletConnect v2",reownAppKit:"Reown AppKit"};
  return (design.provider.order||[]).map((id)=>({id,label:labels[id]||id}));
}
function walletAvailable(id){
  if(id==="injected") return Boolean(window.ethereum);
  if(id==="walletconnectV2") return Boolean(window.WalletConnectProvider);
  if(id==="reownAppKit") return Boolean(window.ReownAppKit||window.reown);
  return false;
}

function createShadowUI(root,design){
  const host=document.createElement("div");
  const shadow=host.attachShadow({mode:"open"});
  root.appendChild(host);
  const style=document.createElement("style");
  style.textContent=':host{all:initial}.forge-shell{font-family:Inter,system-ui,sans-serif;color:'+design.colors.text+'}.forge-btn{cursor:pointer;border:1px solid rgba(148,163,184,0.35);background:'+design.colors.surface+';color:'+design.colors.text+';padding:10px 12px;border-radius:'+design.radius+'px}.forge-card{background:'+design.colors.surface+';border:1px solid rgba(99,102,241,0.3);padding:12px;border-radius:'+design.radius+'px;margin-top:10px}.forge-input,.forge-select{width:100%;background:#0a1020;color:'+design.colors.text+';border:1px solid rgba(148,163,184,0.35);padding:8px;border-radius:10px}.forge-status{margin-top:12px;white-space:pre-wrap;border:1px solid rgba(148,163,184,0.2);padding:10px;border-radius:10px;background:rgba(2,6,23,0.75)}.forge-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,0.72);backdrop-filter:blur('+design.backdropBlur+'px);z-index:9999}.forge-modal.open{display:flex}.forge-modal-card{width:min(calc(100vw - 32px),'+design.dimensions.width+'px);max-height:'+design.dimensions.maxHeight+'px;overflow:auto;background:'+design.colors.surface+';color:'+design.colors.text+';border-radius:'+design.radius+'px;padding:18px;border:1px solid rgba(148,163,184,0.2)}.forge-provider-grid{display:grid;gap:8px;grid-template-columns:'+(design.layout==="grid"?'repeat(2,minmax(0,1fr))':'1fr')+'}.forge-muted{color:'+design.colors.muted+';font-size:12px}.forge-danger{color:'+design.colors.danger+'}.forge-header-row{display:flex;justify-content:space-between;gap:8px;align-items:start}.forge-eyebrow{text-transform:uppercase;letter-spacing:.06em;font-size:11px;color:'+design.colors.accent+'}';
  shadow.appendChild(style);
  const app=document.createElement("div");
  app.className="forge-shell";
  shadow.appendChild(app);
  return {host,shadow,app};
}

function buildClient(payload){
  const design=payload.config.ui.modalDesign;
  const state={provider:null,account:null,lastStepSucceeded:null,stepResults:[],providerMode:design.provider.mode||"auto",modalOpen:false,providerSearch:""};
  const api={
    async connect(providerMode){
      if(providerMode) state.providerMode=providerMode;
      const mode=state.providerMode;
      if(mode==="walletconnectV2"&&window.WalletConnectProvider){
        const wc=await window.WalletConnectProvider.init({projectId:design.provider.walletConnect.projectId||undefined,relayUrl:design.provider.walletConnect.relayUrl||undefined,showQrModal:true});
        await wc.enable();
        state.provider=wc;
      } else if(mode==="reownAppKit"&&(window.ReownAppKit||window.reown)){
        const reown=window.ReownAppKit||window.reown;
        if(reown&&typeof reown.openModal==="function") await reown.openModal();
        state.provider=window.ethereum||reown.provider||null;
      } else {
        state.provider=window.ethereum?await getProvider():null;
      }
      if(!state.provider) throw new Error("Selected provider unavailable");
      await ensureChain(state.provider,payload.config.chainId);
      const accounts=await state.provider.request({method:"eth_requestAccounts"});
      state.account=accounts[0]||null;
      return state.account;
    },
    async executeRead(fn,args){const method=fn.selector;const encoded=encodeParams(fn.inputs,args).replace(/^0x/,"");const data=method+encoded;let raw;if(window.ethereum||state.provider){const provider=state.provider||window.ethereum;raw=await provider.request({method:"eth_call",params:[{to:payload.config.contractAddress,data},"latest"]});}else if(payload.config.rpcUrl){raw=await rpcRequest(payload.config.rpcUrl,"eth_call",[{to:payload.config.contractAddress,data},"latest"]);}else{throw new Error("No provider available for read call");}const clean=String(raw).replace(/^0x/,"");const decoded=fn.outputs.length?decodeOutputs(fn.outputs,clean):[];return {raw,decoded};},
    async executeWrite(fn,args,extra){if(!state.provider) await api.connect();const method=fn.selector;const encoded=encodeParams(fn.inputs,args).replace(/^0x/,"");const tx={from:state.account,to:payload.config.contractAddress,data:method+encoded};if(extra&&extra.value!==undefined&&extra.value!==null) tx.value=extra.value;if(extra&&extra.gas!==undefined&&extra.gas!==null) tx.gas=extra.gas;if(extra&&extra.maxFeePerGas!==undefined&&extra.maxFeePerGas!==null) tx.maxFeePerGas=extra.maxFeePerGas;if(extra&&extra.maxPriorityFeePerGas!==undefined&&extra.maxPriorityFeePerGas!==null) tx.maxPriorityFeePerGas=extra.maxPriorityFeePerGas;const hash=await state.provider.request({method:"eth_sendTransaction",params:[tx]});let receipt=null;for(let i=0;i<120;i++){receipt=await state.provider.request({method:"eth_getTransactionReceipt",params:[hash]});if(receipt) break; await new Promise(r=>setTimeout(r,2000));}return {hash,receipt};},
    async executeWorkflow(name,argMap){const wf=payload.config.workflows.find(w=>w.name===name);if(!wf) throw new Error("Workflow not found");const results=[];let prevOk=null;for(const step of wf.steps){if(step.condition==="previousStepSucceeded"&&prevOk!==true) continue;if(step.condition==="previousStepFailed"&&prevOk!==false) continue;const fn=payload.functions.find(f=>f.signature===step.signature);if(!fn) throw new Error("Missing function for workflow step: "+step.signature);const args=(argMap&&argMap[step.signature])||[];let ok=false;let attempts=0;let lastErr=null;while(attempts<=step.retryAttempts&&!ok){try{const action=fn.kind==="read"? await api.executeRead(fn,args):await api.executeWrite(fn,args,{});results.push({step:step.id,signature:step.signature,ok:true,action});ok=true;}catch(e){lastErr=e;attempts++;if(attempts<=step.retryAttempts&&step.backoffMs>0){await new Promise(r=>setTimeout(r,step.backoffMs));}}}
if(!ok){results.push({step:step.id,signature:step.signature,ok:false,error:lastErr?String(lastErr.message||lastErr):"unknown"});if(step.fallback==="abort") {prevOk=false;break;}prevOk=false;continue;}prevOk=true;}state.stepResults=results;state.lastStepSucceeded=prevOk;return {bestEffort:true,results};},
    openModal(){state.modalOpen=true;},
    closeModal(){state.modalOpen=false;},
    getState(){return {...state};}
  };
  return api;
}

function render(payload){
  const design=payload.config.ui.modalDesign;
  const root=mountRoot(payload.config.ui.mountSelector||"#app");
  root.innerHTML="";
  const ui=createShadowUI(root,design);
  const app=ui.app;
  const client=buildClient(payload);
  const providers=toProviderItems(design);
  const status=document.createElement("div");status.className="forge-status";status.textContent="Ready";

  const modal=document.createElement("div");modal.className="forge-modal";
  const modalCard=document.createElement("div");modalCard.className="forge-modal-card";
  const header=document.createElement("div");header.className="forge-header-row";
  const heading=document.createElement("div");
  heading.innerHTML='<div class="forge-eyebrow">'+design.copy.eyebrow+'</div><h3 style="margin:4px 0">'+design.copy.title+'</h3><p class="forge-muted" style="margin:0">'+design.copy.description+'</p>';
  const close=document.createElement("button");close.className="forge-btn";close.textContent="Close";close.onclick=()=>{modal.classList.remove("open");};
  header.appendChild(heading);header.appendChild(close);modalCard.appendChild(header);

  if(design.features.enableSearch){
    const search=document.createElement("input");search.className="forge-input";search.placeholder=design.copy.searchPlaceholder;search.style.marginTop="10px";
    search.oninput=()=>{renderProviders(search.value||"");};
    modalCard.appendChild(search);
  }

  const providerGrid=document.createElement("div");providerGrid.className="forge-provider-grid";providerGrid.style.marginTop="10px";
  const empty=document.createElement("div");empty.className="forge-muted";empty.textContent=design.copy.emptyState;empty.style.display="none";

  function renderProviders(search){
    providerGrid.innerHTML="";
    const lowered=(search||"").toLowerCase();
    const shown=providers.filter(p=>p.label.toLowerCase().includes(lowered));
    empty.style.display=shown.length?"none":"block";
    shown.forEach((provider)=>{
      const btn=document.createElement("button");btn.className="forge-btn";
      btn.textContent=provider.label+(walletAvailable(provider.id)?"":" (unavailable)");
      btn.onclick=async()=>{try{await client.connect(provider.id);status.textContent="Connected via "+provider.label;modal.classList.remove("open");renderWalletDetails();}catch(error){status.textContent="Connection error: "+String(error.message||error);}};
      providerGrid.appendChild(btn);
    });
  }

  modalCard.appendChild(providerGrid);
  modalCard.appendChild(empty);
  renderProviders("");

  if(design.features.enableHelpPanel){
    const help=document.createElement("div");help.className="forge-card";
    help.innerHTML='<div class="forge-muted">'+design.copy.helpText+'</div><div class="forge-danger" style="margin-top:6px">'+design.copy.safetyCopy+'</div>';
    modalCard.appendChild(help);
  }

  modal.appendChild(modalCard);
  ui.shadow.appendChild(modal);

  const controls=document.createElement("div");
  const openBtn=document.createElement("button");openBtn.className="forge-btn";openBtn.textContent=design.controls.triggerLabel||payload.config.ui.walletButtonLabel||"Connect Wallet";
  openBtn.onclick=()=>{modal.classList.add("open");};
  if(design.controls.triggerMode!=="programmatic") controls.appendChild(openBtn);

  if(design.controls.triggerMode==="selector"&&design.controls.triggerSelector){
    const external=document.querySelector(design.controls.triggerSelector);
    if(external) external.addEventListener("click",()=>modal.classList.add("open"));
  }

  app.appendChild(controls);

  const walletDetails=document.createElement("div");walletDetails.className="forge-card";
  function renderWalletDetails(){
    const state=client.getState();
    if(!design.features.showWalletDetails){walletDetails.style.display="none";return;}
    walletDetails.style.display="block";
    walletDetails.innerHTML='<div><strong>Wallet</strong></div><div class="forge-muted">Provider: '+String(state.providerMode||"auto")+'</div><div class="forge-muted">Account: '+String(state.account||"Not connected")+'</div><div class="forge-muted">Chain: '+String(payload.config.chainId)+'</div>';
  }
  renderWalletDetails();
  app.appendChild(walletDetails);

  if(design.features.showBranding){
    const brand=document.createElement("div");brand.className="forge-muted";brand.style.marginTop="8px";
    brand.textContent=design.branding.productName+" · "+design.branding.subtitle;
    app.appendChild(brand);
  }

  for(const fn of payload.functions){const card=document.createElement("div");card.className="forge-card";const h=document.createElement("h3");h.style.margin="0 0 8px 0";h.textContent=(fn.customLabel||fn.name)+" ["+fn.kind+"]";card.appendChild(h);if(fn.description){const p=document.createElement("p");p.className="forge-muted";p.textContent=fn.description;card.appendChild(p);}const controls=[];for(const input of fn.inputs){const wrap=document.createElement("div");wrap.style.marginTop="8px";const label=document.createElement("label");label.className="forge-muted";label.textContent=input.label||input.name||input.type;const inp=document.createElement("input");inp.className="forge-input";inp.value=input.defaultValue||"";inp.placeholder=input.type;inp.dataset.paramType=input.type;wrap.appendChild(label);wrap.appendChild(inp);controls.push({input:inp});card.appendChild(wrap);}let valueInput=null;if(fn.kind==="payable"){const wrap=document.createElement("div");wrap.style.marginTop="8px";const label=document.createElement("label");label.className="forge-muted";label.textContent="Transaction value (wei)";const inp=document.createElement("input");inp.className="forge-input";inp.placeholder="uint256";wrap.appendChild(label);wrap.appendChild(inp);valueInput=inp;card.appendChild(wrap);}const button=document.createElement("button");button.className="forge-btn";button.style.marginTop="10px";button.textContent=fn.kind==="read"?"Read":"Send Transaction";button.onclick=async()=>{try{const args=controls.map(c=>parseValueForType(c.input.dataset.paramType,c.input.value));if(fn.kind==="read"){const out=await client.executeRead(fn,args);status.textContent="Read success\\n"+JSON.stringify(out,null,2);}else{const out=await client.executeWrite(fn,args,{value:valueInput?valueInput.value:undefined,gas:payload.config.txStrategy.defaultGasLimit,maxFeePerGas:payload.config.txStrategy.defaultMaxFeePerGas,maxPriorityFeePerGas:payload.config.txStrategy.defaultMaxPriorityFeePerGas});status.textContent="Tx submitted\\n"+JSON.stringify(out,null,2);renderWalletDetails();}}catch(error){status.textContent="Execution error: "+String(error.message||error);}};card.appendChild(button);app.appendChild(card);} 

  if(payload.config.workflows.length){const wfBox=document.createElement("div");wfBox.className="forge-card";const select=document.createElement("select");select.className="forge-select";payload.config.workflows.forEach(w=>{const o=document.createElement("option");o.value=w.name;o.textContent=w.name;select.appendChild(o);});const run=document.createElement("button");run.className="forge-btn";run.style.marginTop="10px";run.textContent="Run Workflow";run.onclick=async()=>{try{const out=await client.executeWorkflow(select.value,{});status.textContent="Workflow finished (best-effort)\\n"+JSON.stringify(out,null,2);}catch(error){status.textContent="Workflow error: "+String(error.message||error);}};wfBox.appendChild(select);wfBox.appendChild(run);app.appendChild(wfBox);}app.appendChild(status);

  const api={payload,client,openModal:()=>modal.classList.add("open"),closeModal:()=>modal.classList.remove("open"),showWalletModal:()=>modal.classList.add("open"),runtimeVersion:RUNTIME_VERSION};
  window.EndTxClient=api;
  if(design.controls.triggerMode==="programmatic"){
    // no automatic modal open
  }
}

render(PAYLOAD);\n})();\n`;
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
  const modalDesign = resolveModalDesign(config.ui.modalDesign);
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

  const normalizedConfig = {
    ...config,
    ui: {
      ...config.ui,
      modalDesign,
    },
  };

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
      deterministicConfigHash: hashString(stableStringify(normalizedConfig)),
      modalDesignSchemaVersion: modalDesign.schemaVersion,
      modalDesignHash: hashString(stableStringify(modalDesign)),
    },
    config: {
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
      contractAddress: config.contractAddress,
      ui: {
        ...config.ui,
        modalDesign,
      },
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
