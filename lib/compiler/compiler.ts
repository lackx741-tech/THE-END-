import { parseAbi } from "@/lib/compiler/abi";
import { buildTypedDataTemplate } from "@/lib/compiler/eip712";
import { normalizeSelectedFunctions, validateProjectConfig } from "@/lib/compiler/config";
import type { ParsedAbiFunction, ProjectConfig } from "@/lib/compiler/types";

function stableSortObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortObject(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce((accumulator, key) => {
        (accumulator as Record<string, unknown>)[key] = stableSortObject(
          (value as Record<string, unknown>)[key],
        );
        return accumulator;
      }, {} as T);
  }

  return value;
}

export function stableStringify(value: unknown) {
  return JSON.stringify(stableSortObject(value));
}

function toRuntimeFunction(config: ProjectConfig, parsedFunction: ParsedAbiFunction) {
  const selected = config.selectedFunctions.find((item) => item.signature === parsedFunction.signature);
  const eip712 = buildTypedDataTemplate(parsedFunction);

  return {
    ...parsedFunction,
    label: selected?.label ?? parsedFunction.name,
    description: selected?.description ?? "",
    argumentLabels: stableSortObject(selected?.argumentLabels ?? {}),
    defaults: stableSortObject(selected?.defaults ?? {}),
    eip712,
  };
}

function normalizeWorkflows(config: ProjectConfig) {
  return config.workflows.map((workflow) => ({
    ...workflow,
    steps: [...workflow.steps],
  }));
}

export function buildCompilerManifest(config: ProjectConfig) {
  return {
    compiler: "the-end/1.0.0",
    generatedAt: "deterministic",
    projectName: config.projectName,
    version: config.version,
    chain: config.chain,
    contract: {
      address: config.contract.address,
    },
  };
}

export function compileStandaloneScript(input: ProjectConfig) {
  const config = validateProjectConfig(input);
  const parsedFunctions = parseAbi(config.contract.abi);
  const selectedFunctions = normalizeSelectedFunctions(config.selectedFunctions)
    .map((selected) => parsedFunctions.find((item) => item.signature === selected.signature))
    .filter((item): item is ParsedAbiFunction => Boolean(item))
    .map((parsedFunction) => toRuntimeFunction(config, parsedFunction));

  const runtimeConfig = stableSortObject({
    manifest: buildCompilerManifest(config),
    projectName: config.projectName,
    version: config.version,
    chain: config.chain,
    contract: {
      address: config.contract.address,
    },
    backendEndpoints: config.backendEndpoints,
    eip712: config.eip712,
    functions: selectedFunctions,
    workflows: normalizeWorkflows(config),
  });

  const payload = stableStringify(runtimeConfig);

  return `(function(){
const runtime=${payload};
const styleId="the-end-runtime-style";
const rootId="the-end-runtime-root";
const statusClassMap={idle:"border-white/10 bg-white/5 text-slate-300",success:"border-emerald-500/40 bg-emerald-500/10 text-emerald-200",error:"border-rose-500/40 bg-rose-500/10 text-rose-100",pending:"border-sky-500/40 bg-sky-500/10 text-sky-100"};
function injectStyles(){
 if(document.getElementById(styleId)) return;
 const style=document.createElement("style");
 style.id=styleId;
 style.textContent=':root{color-scheme:dark;}#'+rootId+'{font-family:Inter,Arial,sans-serif;background:linear-gradient(180deg,#020617 0%,#0f172a 100%);color:#e2e8f0;padding:24px;border-radius:24px;border:1px solid rgba(148,163,184,.2);box-shadow:0 30px 80px rgba(15,23,42,.45);max-width:1080px;margin:24px auto;}#'+rootId+' .te-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;}#'+rootId+' .te-card{border:1px solid rgba(148,163,184,.2);background:rgba(15,23,42,.88);backdrop-filter:blur(16px);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:14px;}#'+rootId+' .te-muted{color:#94a3b8;font-size:14px;line-height:1.5;}#'+rootId+' label{font-size:13px;color:#cbd5e1;display:block;margin-bottom:6px;}#'+rootId+' input,#'+rootId+' textarea{width:100%;border-radius:14px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.7);color:#f8fafc;padding:11px 14px;font-size:14px;outline:none;}#'+rootId+' textarea{min-height:100px;resize:vertical;}#'+rootId+' button{border:none;border-radius:999px;padding:12px 18px;font-weight:600;font-size:14px;background:linear-gradient(135deg,#38bdf8 0%,#8b5cf6 100%);color:white;cursor:pointer;}#'+rootId+' button[disabled]{opacity:.6;cursor:not-allowed;}#'+rootId+' .te-secondary{background:rgba(148,163,184,.12);}#'+rootId+' pre{white-space:pre-wrap;word-break:break-word;background:rgba(2,6,23,.55);border-radius:16px;padding:14px;font-size:12px;line-height:1.55;border:1px solid rgba(148,163,184,.14);}#'+rootId+' .te-status{border:1px solid rgba(148,163,184,.14);border-radius:16px;padding:12px 14px;font-size:13px;}#'+rootId+' .te-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;}#'+rootId+' .te-pill{border-radius:999px;padding:6px 10px;font-size:12px;border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.04);}';
 document.head.appendChild(style);
}
function ensureRoot(){
 let root=document.getElementById(rootId);
 if(root) return root;
 root=document.createElement('section');
 root.id=rootId;
 (document.currentScript&&document.currentScript.parentElement?document.currentScript.parentElement:document.body).appendChild(root);
 return root;
}
function parseValue(meta, raw){
 if(meta.isArray){
  if(raw === '') return [];
  const parsed=JSON.parse(raw);
  if(!Array.isArray(parsed)) throw new Error('Expected a JSON array for '+meta.name+'.');
  return parsed;
 }
 if(meta.isTuple){
  if(raw === '') return {};
  const parsed=JSON.parse(raw);
  if(!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Expected a JSON object for '+meta.name+'.');
  return parsed;
 }
 const type=meta.canonicalType;
 if(type === 'bool') return raw === 'true';
 if(type === 'address' || type === 'string' || type.startsWith('bytes')) return raw;
 if(type.startsWith('uint') || type.startsWith('int')) return raw;
 return raw;
}
async function getWalletAccount(){
 if(!window.ethereum || typeof window.ethereum.request !== 'function') throw new Error('A wallet with EIP-1193 support is required.');
 const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
 if(!accounts || !accounts[0]) throw new Error('No wallet account available for EIP-712 signing.');
 return accounts[0];
}
async function signTypedData(typedData){
 const account=await getWalletAccount();
 const signature=await window.ethereum.request({method:'eth_signTypedData_v4',params:[account, JSON.stringify(typedData)]});
 return {account, signature};
}
async function postJson(url,payload,retryCount){
 let attempt=0;
 while(true){
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json().catch(function(){return { message:'Invalid JSON response from backend.' };});
   if(!response.ok){
    throw new Error(data.error || data.message || ('Request failed with status '+response.status));
   }
   return data;
  }catch(error){
   if(attempt >= retryCount) throw error;
   attempt += 1;
   await new Promise(function(resolve){ setTimeout(resolve, Math.min(1000*attempt, 4000)); });
  }
 }
}
function getPathValue(source,path){
 return path.split('.').filter(Boolean).reduce(function(acc,key){ return acc == null ? undefined : acc[key]; }, source);
}
function buildTypedData(fn,args){
 return {domain:runtime.eip712,primaryType:fn.eip712.primaryType,types:fn.eip712.types,message:Object.assign({}, fn.eip712.messageDefaults, args, {projectName:runtime.projectName,functionSignature:fn.signature})};
}
async function executeFunction(fn,args,options){
 const typedData=buildTypedData(fn,args);
 const signed=await signTypedData(typedData);
 const signPayload={signature:signed.signature,account:signed.account,typedData:typedData,functionName:fn.name,functionSignature:fn.signature,args:args};
 const signResult=await postJson(runtime.backendEndpoints.sign, signPayload, options.retryCount || 0);
 const executePayload=signResult.executePayload || {signature:signed.signature,account:signed.account,typedData:typedData,functionName:fn.name,functionSignature:fn.signature,args:args,signResult:signResult};
 const executeResult=await postJson(runtime.backendEndpoints.execute, executePayload, options.retryCount || 0);
 return {signature:signed.signature,typedData:typedData,signResult:signResult,executeResult:executeResult};
}
function renderStatus(container,status,payload){
 container.className='te-status '+(statusClassMap[status] || statusClassMap.idle);
 container.textContent=typeof payload === 'string' ? payload : JSON.stringify(payload,null,2);
}
function escapeRuntimeString(value){
 return String(value == null ? '' : value);
}
function render(){
 injectStyles();
 const root=ensureRoot();
 root.innerHTML='';
 const header=document.createElement('div');
 header.className='te-row';
 const headerLeft=document.createElement('div');
 const compilerPill=document.createElement('div');
 compilerPill.className='te-pill';
 compilerPill.textContent=escapeRuntimeString(runtime.manifest.compiler);
 const heading=document.createElement('h1');
 heading.style.fontSize='28px';
 heading.style.fontWeight='700';
 heading.style.margin='12px 0 6px';
 heading.textContent=escapeRuntimeString(runtime.projectName)+' runtime';
 const subtitle=document.createElement('p');
 subtitle.className='te-muted';
 subtitle.textContent='Public artifact generated from the private operator dashboard. Wallet signatures are EIP-712 only and every signed payload is routed to backend /sign and /execute endpoints.';
 headerLeft.appendChild(compilerPill);
 headerLeft.appendChild(heading);
 headerLeft.appendChild(subtitle);
 const chainPill=document.createElement('div');
 chainPill.className='te-pill';
 chainPill.textContent=escapeRuntimeString(runtime.chain.name)+' · chainId '+runtime.chain.chainId;
 header.appendChild(headerLeft);
 header.appendChild(chainPill);
 root.appendChild(header);
 const functionGrid=document.createElement('div');
 functionGrid.className='te-grid';
 runtime.functions.forEach(function(fn){
  const card=document.createElement('article');
  card.className='te-card';
  const form=document.createElement('form');
  const formHeader=document.createElement('div');
  formHeader.className='te-row';
  const formHeaderLeft=document.createElement('div');
  const formTitle=document.createElement('h2');
  formTitle.style.fontSize='18px';
  formTitle.style.fontWeight='650';
  formTitle.textContent=escapeRuntimeString(fn.label);
  const formDescription=document.createElement('p');
  formDescription.className='te-muted';
  formDescription.textContent=escapeRuntimeString(fn.description || fn.signature);
  formHeaderLeft.appendChild(formTitle);
  formHeaderLeft.appendChild(formDescription);
  const kindPill=document.createElement('div');
  kindPill.className='te-pill';
  kindPill.textContent=escapeRuntimeString(fn.kind);
  formHeader.appendChild(formHeaderLeft);
  formHeader.appendChild(kindPill);
  form.appendChild(formHeader);
  fn.inputs.forEach(function(input){
   const wrapper=document.createElement('div');
   const label=document.createElement('label');
   label.textContent=(fn.argumentLabels[input.name] || input.name)+' · '+input.canonicalType;
   const control=input.isArray || input.isTuple ? document.createElement('textarea') : document.createElement('input');
   control.name=input.name;
   control.placeholder=input.isTuple || input.isArray ? 'Enter JSON value' : input.canonicalType;
   control.value=(fn.defaults[input.name] || '');
   wrapper.appendChild(label);
   wrapper.appendChild(control);
   form.appendChild(wrapper);
  });
  const actions=document.createElement('div');
  actions.className='te-row';
  const button=document.createElement('button');
  button.type='submit';
  button.textContent=fn.kind === 'read' ? 'Sign read intent' : 'Sign and execute';
  actions.appendChild(button);
  form.appendChild(actions);
  const status=document.createElement('pre');
  renderStatus(status,'idle','Awaiting input. This function will sign typed data locally and POST the signature to '+runtime.backendEndpoints.sign+'.');
  form.addEventListener('submit', async function(event){
   event.preventDefault();
   button.disabled=true;
   renderStatus(status,'pending','Preparing EIP-712 payload…');
   try{
    const values={};
    fn.inputs.forEach(function(input){
      const element=form.elements.namedItem(input.name);
      const raw=element && 'value' in element ? element.value : '';
      values[input.name]=parseValue(input, raw);
    });
    const result=await executeFunction(fn, values, {retryCount:0});
    renderStatus(status,'success',result);
   }catch(error){
    renderStatus(status,'error',error instanceof Error ? error.message : String(error));
   }finally{
    button.disabled=false;
   }
  });
  card.appendChild(form);
  card.appendChild(status);
  functionGrid.appendChild(card);
 });
 root.appendChild(functionGrid);
 if(runtime.workflows.length){
  const workflowSection=document.createElement('section');
  workflowSection.style.marginTop='18px';
  const title=document.createElement('h2');
  title.style.fontSize='20px';
  title.style.fontWeight='700';
  title.textContent='Configured workflows';
  workflowSection.appendChild(title);
  const workflowGrid=document.createElement('div');
  workflowGrid.className='te-grid';
  runtime.workflows.forEach(function(workflow){
   const card=document.createElement('article');
   card.className='te-card';
   const button=document.createElement('button');
   button.textContent=workflow.label;
   const status=document.createElement('pre');
   renderStatus(status,'idle',workflow.description || 'Sequential execution with retry and fallback handling.');
   button.addEventListener('click', async function(){
    button.disabled=true;
    const results=[];
    let previousSucceeded=true;
    try{
     for(const step of workflow.steps){
      if(step.condition === 'previous-success' && !previousSucceeded){
       throw new Error('Workflow halted because the previous step failed.');
      }
      const fn=runtime.functions.find(function(item){ return item.signature === step.functionSignature; });
      if(!fn) throw new Error('Workflow function not found: '+step.functionSignature);
      const args={};
      const bindings=step.argumentBindings || {};
      Object.keys(bindings).forEach(function(key){
       const binding=bindings[key];
       if(binding.source === 'previousResult'){
        const previousEntry=results[results.length - 1];
        args[key]=getPathValue(previousEntry && previousEntry.result ? previousEntry.result : (previousEntry || {}), binding.path || '');
       }else{
        args[key]=binding.value;
       }
      });
      try{
       const result=await executeFunction(fn, args, {retryCount:step.retryCount || 0});
       results.push({stepId:step.id, result:result});
       previousSucceeded=true;
      }catch(error){
       previousSucceeded=false;
       results.push({stepId:step.id, error:error instanceof Error ? error.message : String(error)});
       if((step.fallback || 'abort') !== 'continue') throw error;
      }
     }
     renderStatus(status,'success',results);
    }catch(error){
     renderStatus(status,'error',{message:error instanceof Error ? error.message : String(error), results:results});
    }finally{
     button.disabled=false;
    }
   });
   const workflowHeader=document.createElement('div');
   workflowHeader.className='te-row';
   const workflowHeaderLeft=document.createElement('div');
   const workflowTitle=document.createElement('h3');
   workflowTitle.style.fontSize='18px';
   workflowTitle.style.fontWeight='650';
   workflowTitle.textContent=escapeRuntimeString(workflow.label);
   const workflowDescription=document.createElement('p');
   workflowDescription.className='te-muted';
   workflowDescription.textContent=escapeRuntimeString(workflow.description || 'Sequential backend-routed EIP-712 workflow.');
   workflowHeaderLeft.appendChild(workflowTitle);
   workflowHeaderLeft.appendChild(workflowDescription);
   const workflowPill=document.createElement('div');
   workflowPill.className='te-pill';
   workflowPill.textContent=workflow.steps.length+' steps';
   workflowHeader.appendChild(workflowHeaderLeft);
   workflowHeader.appendChild(workflowPill);
   card.appendChild(workflowHeader);
   card.appendChild(button);
   card.appendChild(status);
   workflowGrid.appendChild(card);
  });
  workflowSection.appendChild(workflowGrid);
  root.appendChild(workflowSection);
 }
}
render();
})();`;
}
