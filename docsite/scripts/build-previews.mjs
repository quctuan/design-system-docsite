import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseFragment,serialize} from 'parse5';
import {declarations,unknown} from './preview-css.mjs';
import {sceneHTML} from './scene-preview.mjs';
const require=createRequire(import.meta.url);
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const normal=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'');
const cssName=s=>'--figma-'+s.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const rgb=c=>c?`rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${c.a??1})`:'transparent';
const attrs=n=>Object.fromEntries((n.attrs||[]).map(a=>[a.name,a.value]));
const set=(n,k,v)=>{n.attrs=n.attrs||[];const a=n.attrs.find(a=>a.name===k);if(a)a.value=String(v);else n.attrs.push({name:k,value:String(v)});};
const txt=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(txt).join('');
function walk(n,fn){fn(n);for(const c of n.childNodes||[])walk(c,fn);}
function componentFactory(context){
 let code=context.code;
 code=code.replace(/<SFSymbol\s*\/\s*>|<SFSymbol>[\s\S]*?<\/SFSymbol>/g,'<span data-sf-symbol="" />');
 const match=[...code.matchAll(/function\s+(\w+)\s*\(/g)].at(-1);
 if(!match)throw Error('No component function '+context.nodeId);
 if(!code.includes('export default'))code+='\nexport default '+match[1]+';';
 const propsType=code.match(/type\s+\w+Props\s*=\s*\{([\s\S]*?)\};/g)?.at(-1)||'';
 const propNames=[...propsType.matchAll(/(\w+)\?:\s*([^;]+);/g)].map(m=>({name:m[1],boolean:m[2]==='boolean'}));
 const compiled=transformSync(code,{loader:'tsx',format:'cjs',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'}).code;
 const module={exports:{}};new Function('require','module','exports','React',compiled)(require,module,module.exports,React);
 return {render:v=>renderToStaticMarkup(React.createElement(module.exports.default,Object.fromEntries(Object.entries(v.variantProperties||{}).map(([key,value])=>{const p=propNames.find(p=>normal(p.name)===normal(key));return [p?.name||key,p?.boolean?/^(?:on|true|yes)$/i.test(value):value];})))),propNames};
}
function tokensCSS(I){
 const rules=[];for(const brand of ['VNPT','VIBE CLUB']){
  const values=new Map();for(const t of I.tokens.filter(t=>t.collection!=='1. Color modes'||t.mode===brand)){
   let v=t.value;if(t.type==='color')v=rgb({r:v.components[0],g:v.components[1],b:v.components[2],a:v.alpha});else if(v&&typeof v==='object'&&'r' in v)v=rgb(v);if(typeof v==='object')continue;
   if(/font\/weight\//i.test(t.name))v=({Bold:700,Medium:500,Regular:400,Semibold:600}[v]??v);
   else if(typeof v==='number')v+='px';
   values.set(cssName(t.name),v);
  }
  rules.push(`[data-brand="${brand}"]{${[...values].map(([k,v])=>`${k}:${v}`).join(';')}}`);
 }return rules.join('\n');
}
function styleDOM(html,root){
 const dom=parseFragment(html);dom.childNodes=dom.childNodes.filter(n=>n.nodeName!=='link');
 walk(dom,n=>{if(!n.tagName)return;const a=attrs(n);if(a.class){let css=declarations(a.class);
  if(css.includes('border-width:')&&css.includes('border-style:')){const parts=css.split(';'),width=parts.findLast(x=>x.startsWith('border-width:')).slice(13),color=parts.findLast(x=>x.startsWith('border-color:'))?.slice(13)||'currentColor',style=parts.findLast(x=>x.startsWith('border-style:')).slice(13);css=parts.filter(x=>!/^border-(width|style|color):/.test(x)).concat(`outline:${width} ${style} ${color}`,`outline-offset:calc(${width} * -1)`).join(';');}
  if(n.tagName==='img'&&a.src?.endsWith('.svg'))css=css.split(';').filter(s=>!/^((?:min-|max-)?width|(?:min-|max-)?height):/.test(s)).join(';');
  set(n,'style',css+(a.style?';'+a.style:''));n.attrs=n.attrs.filter(a=>a.name!=='class');}
  if('data-sf-symbol' in a){const id=attrs(n.parentNode)['data-node-id'];const symbols=JSON.parse(fs.readFileSync(path.join(root,'source/sf-symbol-map.json')));const symbol=symbols.find(s=>s.id===id)||symbols.at(-1);n.tagName=n.nodeName='img';set(n,'src',symbol.url);set(n,'alt','');set(n,'style','display:block;align-self:center;flex:none');}
  const next=attrs(n);
  if(n.tagName==='img'&&next.src?.endsWith('.svg')){
   const p=path.join(root,'public',next.src);if(!fs.existsSync(p))throw Error('Missing asset '+next.src);
   const svg=fs.readFileSync(p,'utf8').match(/<svg\b[^>]*>/)?.[0]||'';for(const k of ['width','height']){const value=svg.match(new RegExp(`${k}="([^"]+)"`))?.[1];if(value)set(n,k,value);}
  }
 });return dom;
}
function makeInput(n,name,variant){
 const value=txt(n).trim(),a=attrs(n);const disabled=/disable/i.test(variant.variantProperties?.State||'');
 const password=/password/i.test(variant.variantProperties?.Type||'');
 n.tagName=n.nodeName=name==='textarea'?'textarea':'input';n.childNodes=[];
 set(n,'aria-label',name==='search'?'Search':name==='otp'?'OTP':'Input');set(n,'style',(a.style||'')+';border:0;padding:0;background:transparent;outline:none;min-width:0;max-width:100%;resize:vertical');
 if(name!=='textarea'){set(n,'type',password?'password':name==='search'?'search':'text');if(name==='otp'){set(n,'inputmode','numeric');set(n,'maxlength','1');}}
 if(disabled)set(n,'disabled','');
 if(/place\s*holder|search|placeholder/i.test(value))set(n,'placeholder',value);
 else if(value){if(name==='textarea')n.childNodes=[{nodeName:'#text',value,parentNode:n}];else set(n,'value',password?'12345678':value);}
}
function semantics(dom,p,v){
 const root=dom.childNodes.find(n=>n.tagName);if(!root)return;
 set(root,'data-variant',v.id);set(root,'data-component',p.displayName);
 const props=v.variantProperties||{},disabled=Object.values(props).some(x=>/disable/i.test(x))||(['Buttons','Circular Button'].includes(p.displayName)&&props.Active==='Off');
 const btn=n=>{n.tagName=n.nodeName='button';set(n,'type','button');set(n,'aria-label',txt(n).trim()||p.displayName);if(disabled)set(n,'disabled','');set(n,'style',(attrs(n).style||'')+';cursor:pointer;font:inherit');};
 if(p.displayName==='Buttons'||p.displayName==='Circular Button')btn(root);
 if(p.displayName==='Toggle'){btn(root);set(root,'role','switch');set(root,'aria-checked',String(props.Type==='On'));}
 if(p.displayName==='Checkbox & Radio Option'){
  btn(root);set(root,'role',/radio/i.test(v.family)?'radio':'checkbox');set(root,'aria-checked',props.Indeterminate==='On'?'mixed':String(Object.values(props).some(x=>/^Active/.test(x))));
 }
 if(p.displayName==='Tabs'||p.displayName==='Filter'){btn(root);set(root,'aria-pressed',String(Object.values(props).some(x=>/Selected|Active|On/.test(x))));}
 if(p.displayName==='Alert')set(root,'role',/Destructive|Warning/.test(props.Type)?'alert':'status');
 walk(root,n=>{
  if(!n.tagName)return;const a=attrs(n),text=txt(n).trim();
  if(n.tagName!=='button'&&/^Buttons\/\s*Button/.test(a['data-name']||'')){btn(n);set(n,'data-demo-action','');}
  if(p.displayName==='Keyboard'&&/^(Key|Shift Key|Delete Key|Return|Space)$/.test(a['data-name']||'')){btn(n);set(n,'data-demo-action','');}
  if(p.displayName==='Inputs'&&n.tagName==='p'&&/Place holder|Place\s*holder|Filled content|Typing|●|Search/i.test(text))makeInput(n,/Search/.test(v.family)?'search':/Text area/.test(v.family)?'textarea':'input',v);
  if(p.displayName==='Bottomsheet'&&n.tagName==='p'&&text==='Search')makeInput(n,'search',v);
  if(p.displayName==='OTP'&&(/_OTP/.test(v.family)?n===root:a['data-name']==='_OTP Field'||/^type=/.test(a['data-name']||''))){
   const field=(n.childNodes||[]).find(x=>x.tagName==='p')||n;makeInput(field,'otp',v);}
  if(p.displayName==='Bottomsheet'&&a['data-name']==='Buttons/ Button Glass'){btn(n);set(n,'aria-label','Close bottom sheet');set(n,'data-dismiss','');}
 });
}
function badgeHTML(p,v,layer,contexts,root){
 const f=p.content.formats[v.format],paint=f.fills.find(x=>x.visible!==false&&x.type==='SOLID'),stroke=f.strokes.find(x=>x.visible!==false&&x.type==='SOLID');
 const metric=layer?.[1].find(c=>c[0]==='TEXT')?.[5]?.[0];if(!metric)throw Error('Missing badge text '+v.id);
 const [label,size,font,weightName,weight,line,fills]=metric;
 let template=contexts.find(c=>c.nodeId===v.id)||contexts.find(c=>{const ref=p.content.components.find(v=>v.id===c.nodeId);return ref?.variantProperties?.Icon===v.variantProperties.Icon&&ref?.variantProperties?.Color===v.variantProperties.Color&&ref?.variantProperties?.Type===v.variantProperties.Type;});
 if(!template)template=contexts.find(c=>{const ref=p.content.components.find(v=>v.id===c.nodeId);return ref?.variantProperties?.Icon===v.variantProperties.Icon;});
 const templateDOM=styleDOM(componentFactory(template).render({...v,variantProperties:{}}),root),templateRoot=templateDOM.childNodes.find(n=>n.tagName),templateText=templateRoot.childNodes.find(n=>n.tagName==='p');
 const color=attrs(templateText).style.match(/(?:^|;)color:([^;]+)/)?.[1]||rgb(fills[0]);
 const templateBG=attrs(templateRoot).style.match(/(?:^|;)background:([^;]+)/)?.[1],templateStroke=attrs(templateRoot).style.match(/(?:^|;)outline:([^;]+)/)?.[1];
 let icons='';if(v.variantProperties.Icon!=='False'){const children=templateRoot.childNodes||[];icons=children.filter(n=>n.tagName&&n.tagName!=='p').map(n=>{const sz=layer[1].find(c=>c[0]!=='TEXT')?.[2];if(sz){const a=attrs(n),original=Number(a.style.match(/(?:^|;)width:(\d+(?:\.\d+)?)px/)?.[1]);set(n,'style',(a.style||'')+`;width:${sz}px;height:${sz}px`);if(original&&original!==sz)walk(n,c=>{if(c.tagName==='img')set(c,'style',(attrs(c).style||'')+`;transform:scale(${sz/original});transform-origin:top left`);});}return serialize({nodeName:'#document-fragment',childNodes:[n]});}).join('');}
 const text=`<p style="font-family:'SF Pro Display',-apple-system,sans-serif;font-size:${size}px;font-weight:${weight};line-height:${line.value||size*1.3}px;color:${color};white-space:nowrap">${esc(label)}</p>`;
 const child=v.variantProperties.Icon==='Icon trailing'?text+icons:icons+text;
 return `<div data-node-id="${v.id}" style="display:flex;align-items:center;gap:${f.itemSpacing}px;padding:${f.paddingTop}px ${f.paddingRight}px ${f.paddingBottom}px ${f.paddingLeft}px;border-radius:${f.cornerRadius}px;background:${templateBG|| (paint?rgb({...paint.color,a:paint.opacity}):'transparent')};${stroke?`outline:${templateStroke||f.strokeWeight+'px solid '+rgb(stroke.color)};outline-offset:-${f.strokeWeight}px;`:''}">${child}</div>`;
}
const reset=`*{box-sizing:border-box}html,body{margin:0;min-height:100%;color-scheme:light}body{font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:24px;color:#34404b;-webkit-font-smoothing:antialiased}p{margin:0}input::placeholder,textarea::placeholder{color:inherit;opacity:1}button,input,textarea{font:inherit;color:inherit}button{padding:0;background:none;border:0}img{display:block}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #3079ff;outline-offset:3px}[hidden]{display:none!important}.stage{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px;overflow:auto}.component{position:relative;flex:none;max-width:100%}.status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}@media(max-width:430px){.stage{padding:16px}}`;
export function buildPreviews({root,out,I,write,json}){
 const dir=path.join(root,'source/live-contexts');let contexts=fs.readdirSync(dir).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))).filter(c=>!c.code.trim().startsWith('<'));
 const previous=[...JSON.parse(fs.readFileSync(path.join(root,'source/prototypes.json'))),...JSON.parse(fs.readFileSync(path.join(root,'source/code-contexts.json'))).contexts,...JSON.parse(fs.readFileSync(path.join(root,'source/additional-code-contexts.json')))];
 for(const p of previous)if(!contexts.some(c=>c.nodeId===p.nodeId))contexts.push({nodeId:p.nodeId,code:p.texts[0]});
 const localize=code=>code.replace(/https:\/\/www\.figma\.com\/api\/mcp\/asset\/([a-z0-9-]+\.(?:svg|png|jpg|jpeg|webp))/g,'/assets/$1');
 contexts=contexts.map(c=>({...c,code:localize(c.code)}));
 const factories=new Map(contexts.map(c=>[c.nodeId,componentFactory(c)]));
 const layers=new Map(JSON.parse(fs.readFileSync(path.join(root,'source/badge-layer-specs.json'))).map(x=>[x[0],x]));
 const tokens=tokensCSS(I),catalogue={},issues=[];
 const scenes=JSON.parse(fs.readFileSync(path.join(root,'source/additional-preview-scenes.json'))),sceneAssets=JSON.parse(fs.readFileSync(path.join(root,'source/additional-scene-assets.json'))),sceneInstances=JSON.parse(fs.readFileSync(path.join(root,'source/additional-scene-instances.json')));
 for(const p of I.pages.filter(p=>['component','application-component'].includes(p.pageKind))){
  const spec=I.componentSpecs[p.source.pageId],cases=[];
  for(const v of p.content.components.filter(v=>v.type==='COMPONENT')){
   const variant=spec.variants.find(x=>x.id===v.id);let ctx=contexts.find(c=>c.nodeId===v.id)||contexts.find(c=>c.nodeId===v.parentId);let html;
   if(scenes[v.id])html=sceneHTML(scenes[v.id],sceneAssets,sceneInstances,instance=>{
    const factory=factories.get(instance.parent)||factories.get(instance.main);
    if(factory)return factory.render({variantProperties:Object.fromEntries(Object.entries(instance.properties).filter(([,v])=>v.type!=='INSTANCE_SWAP').map(([k,v])=>[k.split('#')[0],v.value]))});
    if(instance.main==='9323:38484')return '<div style="position:relative;overflow:hidden;width:20px;height:20px"><div style="position:absolute;inset:8.33%"><img src="/assets/1104b480-0449-4fe2-b471-97e0e6a4d782.svg" alt=""></div></div>';
    if(instance.main==='9323:38498')return '<img src="/assets/6ce3fbd5-5c38-4cbc-a102-fac98b1aa9ac.svg" alt="">';
    throw Error('No code or exact matching asset for '+instance.id);
   });
   else if(p.displayName==='Overlay')html=`<div data-node-id="${v.id}" style="width:375px;height:812px;background:rgba(10,22,45,${v.variantProperties.Type==='Blur'?'0.9':'0.6'});${v.variantProperties.Type==='Blur'?'backdrop-filter:blur(16px)':''}"></div>`;
   else if(p.displayName==='Badge')html=badgeHTML(p,v,layers.get(v.id),contexts.filter(c=>p.content.components.some(v=>v.id===c.nodeId)),root);
   else if(ctx){try{html=factories.get(ctx.nodeId).render(v);}catch(e){issues.push({id:v.id,error:e.message});continue;}}
   else{issues.push({id:v.id,name:p.displayName,reason:'No high fidelity context available'});continue;}
   const dom=styleDOM(html,root),r=dom.childNodes.find(n=>n.tagName);if(!r){issues.push({id:v.id,reason:'No rendered root'});continue;}
   // Set contexts can omit unsupported branch types; expose only a real matching variant.
   const actualID=attrs(r)['data-node-id']||attrs(r).id?.replace(/^node-/,'').replace('_',':');
   if(actualID&&actualID!==v.id){issues.push({id:v.id,rendered:actualID,reason:'Source branch does not match variant'});continue;}
   semantics(dom,p,{...v,family:variant.family});
   const body=serialize(dom),url=`/previews/${spec.slug}/${v.id.replace(':','-')}.html`;
   const dark=variant.variantProperties.Type==='Dark',canvas=p.displayName==='Bottomsheet'?(dark?'#34404b':'#f3f4f6'):'#fff';
   const props=variant.variantProperties;
   const transition=p.displayName==='Toggle'?{Type:props.Type==='On'?'Off':'On'}:
    p.displayName==='Filter'?{Active:props.Active==='On'?'Off':'On'}:
    variant.family==='Check box'?{Tyoe:props.Tyoe==='Active'?'_Checkbox base':'Active',Indeterminate:'Off'}:
    variant.family==='Radio'?{Status:props.Status==='Active'?'Off':'Active'}:
    variant.family==='Pill tabs'?{State:props.State==='Selected'?'Normal':'Selected'}:
    variant.family==='_Segmented control/Element'?{Type:props.Type==='Active'?'Default':'Active'}:
    variant.family==='_Tab states'?{Selected:props.Selected==='On'?'Off':'On'}:null;
   const counterpart=transition&&spec.variants.find(x=>x.family===variant.family&&x.id!==v.id&&Object.keys(props).every(k=>x.variantProperties[k]===(transition[k]??props[k])));
   const interactive=['Toggle','Checkbox & Radio Option','Tabs','Filter'].includes(p.displayName)&&counterpart;
   const script=`const query=new URLSearchParams(location.search);document.body.dataset.brand=query.get('brand')||'VNPT';\nconst root=document.querySelector('[data-variant]');\n${interactive?`root.addEventListener('click',()=>{if(root.disabled)return;if(parent===window)location.href=${JSON.stringify('/previews/'+spec.slug+'/'+counterpart.id.replace(':','-')+'.html')}+'?'+query;else parent.postMessage({type:'vnpt-variant',id:${JSON.stringify(counterpart.id)},slug:${JSON.stringify(spec.slug)}},location.origin);});`:`root.addEventListener('click',()=>{if(root.tagName==='BUTTON'&&!root.disabled){document.querySelector('[role="status"]').textContent='Activated '+root.getAttribute('aria-label');if(parent!==window)parent.postMessage({type:'vnpt-action',label:root.getAttribute('aria-label')},location.origin);}});`}\nfor(const b of document.querySelectorAll('[data-demo-action]'))b.addEventListener('click',()=>{if(!b.disabled){document.querySelector('.status').textContent='Activated '+b.getAttribute('aria-label');if(parent!==window)parent.postMessage({type:'vnpt-action',label:b.getAttribute('aria-label')},location.origin);}});\nfor(const b of document.querySelectorAll('[data-dismiss]'))b.addEventListener('click',()=>{root.hidden=true;document.querySelector('[data-reopen]').hidden=false;});\ndocument.querySelector('[data-reopen]')?.addEventListener('click',e=>{root.hidden=false;e.currentTarget.hidden=true;});`;
   const source=`<!doctype html>\n<!-- VNPT ${p.displayName} · ${v.id} · ${v.name} -->\n<!-- Browser preview implementation; native app uses Swift / Kotlin / Java. -->\n<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.displayName)} · ${esc(v.name)}</title>\n<style>\n${reset}\n${tokens}\nbody{background:${canvas}}\n</style></head>\n<body data-brand="VNPT"><main class="stage"><div class="component">\n${body}\n</div>${p.displayName==='Bottomsheet'?'<button data-reopen hidden type="button">Mở lại Bottomsheet</button>':''}<span role="status" class="status" aria-live="polite"></span></main>\n<script>\n${script}\n</script></body></html>`;
   write(url.slice(1),source);
   const files=[...new Set([...body.matchAll(/src="(\/assets\/[^" ]+)"/g)].map(m=>m[1]))];for(const f of files)if(!fs.existsSync(path.join(root,'public',f)))throw Error('Missing visible asset '+f);
   cases.push({id:v.id,name:v.name,family:variant.family,properties:v.variantProperties,url,files,width:v.width,height:v.height,canvas});
  }
  if(!cases.some(c=>c.id===spec.defaultVariantId)){fs.writeFileSync(path.join(root,'../work/live-preview-issues.json'),JSON.stringify(issues,null,2));throw Error('Missing default preview '+p.displayName);}
  catalogue[spec.slug]={name:p.displayName,defaultVariantId:spec.defaultVariantId,cases};
  json(`data/previews/${spec.slug}.json`,catalogue[spec.slug]);
 }
 json('data/preview-coverage.json',{components:Object.keys(catalogue).length,cases:Object.values(catalogue).reduce((n,p)=>n+p.cases.length,0),issues,unknownUtilities:[...unknown]});
 console.log('Code previews:',Object.values(catalogue).reduce((n,p)=>n+p.cases.length,0),'unavailable:',issues.length,'CSS utilities needing translation:',unknown.size);
 return catalogue;
}
