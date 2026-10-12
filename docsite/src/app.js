import {escape,icon,codeBlock,tokenVar,cssValue} from '/templates.js';
import {componentContext} from '/component-spec.js';
import {renderVariantSpec} from '/component-view.js';
const data=JSON.parse(document.querySelector('#page-data').textContent);
const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
let toastTimer;
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),1800)}
async function copy(t){try{await navigator.clipboard.writeText(t);toast('Copied to clipboard')}catch{const a=document.createElement('textarea');a.value=t;document.body.append(a);a.select();document.execCommand('copy');a.remove();toast('Copied to clipboard')}}
function theme(t){localStorage.setItem('ds-theme',t);document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t;$$('[data-theme]').filter(e=>e.tagName==='BUTTON').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===t)))}
theme(localStorage.getItem('ds-theme')||'system');
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>{if(localStorage.getItem('ds-theme')==='system')theme('system')});
$$('button[data-theme]').forEach(b=>b.addEventListener('click',()=>theme(b.dataset.theme)));
$$('[data-copy]').forEach(b=>b.addEventListener('click',()=>copy($('code',b.closest('.code-block')).textContent)));
$$('[data-copy-value]').forEach(b=>b.addEventListener('click',()=>copy(b.dataset.copyValue)));
$$('[data-copy-prompt]').forEach(b=>b.addEventListener('click',()=>copy(`Use the VNPT Design System documented at ${location.origin}. Read ${location.origin}/agents.md first. Component: ${data.page?.displayName||document.title}. Source specification: ${location.origin}/data/pages/${data.page?.source?.pageId?.replace(':','-')}.json. Choose an actual variant, preserve token names and aliases, and use VNPT or VIBE CLUB brand mode. Follow source guidelines and review source notes.`)));
const variantSelect=$('[data-variant-select]'),brandSelect=$('[data-spec-brand]');
let variantRequest=0;
let currentPreviewSource='';
async function showCodePreview(id,request){
 const frame=$('[data-component-frame]'),code=$('[data-component-code]');if(!frame)return;
 const item=data.codePreview?.cases.find(c=>c.id===id);
 const prompt=$('[data-copy-component-prompt]');prompt.disabled=true;currentPreviewSource='';
 if(!item){frame.hidden=true;code.innerHTML='<p class="callout">Variant này hiện có design spec và Figma source; chưa có preview code đã đối chiếu. Chọn một ví dụ Usage để xem code chạy được.</p>';frame.parentElement.querySelector('.preview-unavailable')?.remove();frame.parentElement.insertAdjacentHTML('beforeend','<p class="preview-unavailable meta">Chưa có preview code cho variant này. Design spec bên dưới vẫn là dữ liệu Figma gốc.</p>');return;}
 frame.hidden=false;frame.parentElement.querySelector('.preview-unavailable')?.remove();
 const url=item.url+'?brand='+encodeURIComponent(brandSelect?.value||'VNPT');
 if(frame.getAttribute('src')!==url)frame.src=url;
 frame.parentElement.style.height=Math.max(452,Math.min(item.height+64,920))+'px';
 $('[data-download-preview]').href=item.url;$('[data-open-preview]').href=url;
 code.innerHTML=codeBlock('Đang tải code…','HTML · CSS · JavaScript');
 try{const response=await fetch(item.url);if(!response.ok)throw Error(response.status);const source=await response.text();if(request!==variantRequest)return;currentPreviewSource=source;code.innerHTML=codeBlock(source,'HTML · CSS · JavaScript');prompt.disabled=false;}catch{if(request===variantRequest)code.innerHTML='<p>Không tải được code. Chọn lại variant để thử lại.</p>';}
}
async function showVariant(){
 if(!data.componentSpec||!variantSelect)return;
 const request=++variantRequest;
 const variant=data.componentSpec.variants.find(v=>v.id===variantSelect.value);
 const copyButton=$('[data-copy-agent-context]');copyButton.disabled=true;$('[data-copy-component-prompt]').disabled=true;
 if(!variant.rootFields){
  $('[data-variant-spec]').setAttribute('aria-busy','true');
  try{
   const response=await fetch(`/data/component-variants/${data.componentSpec.slug}/${variant.id.replace(':','-')}.json`);
   if(!response.ok)throw Error(response.status);
   Object.assign(variant,await response.json());
  }catch{if(request===variantRequest){$('[data-variant-spec]').innerHTML='<p>Không tải được spec. Chọn lại variant để thử lại.</p>';$('[data-variant-spec]').setAttribute('aria-busy','false');}return;}
 }
 if(request!==variantRequest)return;
 await showCodePreview(variant.id,request);if(request!==variantRequest)return;
 $('[data-variant-spec]').innerHTML=renderVariantSpec(data.componentSpec,variantSelect.value,brandSelect.value);
 $('[data-variant-spec]').setAttribute('aria-busy','false');copyButton.disabled=false;
 $('[data-selected-figma]').href=variant.figmaUrl;
 const params=new URLSearchParams(location.search);params.set('variant',variant.id);params.set('brand',brandSelect.value);
 history.replaceState(null,'',location.pathname+'?'+params+location.hash);
}
if(data.componentSpec&&variantSelect){
 const params=new URLSearchParams(location.search);
 if(data.componentSpec.variants.some(v=>v.id===params.get('variant')))variantSelect.value=params.get('variant');
 if(['VNPT','VIBE CLUB'].includes(params.get('brand')))brandSelect.value=params.get('brand');
 variantSelect.addEventListener('change',showVariant);brandSelect.addEventListener('change',showVariant);
 showVariant();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-component-code] [data-copy]');if(b)copy($('code',b.closest('.code-block')).textContent);});
$('[data-copy-component-prompt]')?.addEventListener('click',()=>{
 const v=data.componentSpec.variants.find(v=>v.id===variantSelect.value);
 copy(`Use the VNPT Design System at ${location.origin}. Read ${location.origin}/agents.md.\nComponent: ${data.componentSpec.name}. Actual Figma variant: ${v.id}, ${v.name}. Brand: ${brandSelect.value}.\nFor iOS use Swift; for Android use Kotlin/Java with the app repository's framework. The code below is a runnable browser preview, not a native SDK. Preserve the selected design specification, token identities and assets when implementing native code.\n\n${componentContext(data.componentSpec,v.id,location.origin)}\n\nRunnable preview: ${location.origin}${data.codePreview.cases.find(c=>c.id===v.id).url}\n\n`+String.fromCharCode(96).repeat(3)+'html\n'+currentPreviewSource+'\n'+String.fromCharCode(96).repeat(3));
});
$$('[data-select-example]').forEach(b=>b.addEventListener('click',async()=>{variantSelect.value=b.dataset.selectExample;await showVariant();$('[data-preview-tab="code"]').click();$('#preview-variants').scrollIntoView({behavior:'smooth'});}));
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('[data-component-frame]')?.contentWindow)return;if(e.data.type==='vnpt-variant'&&e.data.slug===data.componentSpec?.slug&&data.codePreview.cases.some(c=>c.id===e.data.id)){variantSelect.value=e.data.id;showVariant();}if(e.data.type==='vnpt-action')toast(e.data.label+' activated');});
const usageFilter=$('[data-usage-filter]');usageFilter?.addEventListener('input',()=>{let count=0;$$('[data-usage-case]').forEach(c=>{c.hidden=!c.dataset.name.includes(usageFilter.value.toLowerCase());if(!c.hidden)count++;});$('[data-usage-count]').textContent=count+' examples';$('.usage-empty').hidden=count>0;});
const usageResize=new ResizeObserver(entries=>{for(const {target:stage} of entries){const frame=$('iframe',stage),w=Number(frame.dataset.width),h=Number(frame.dataset.height),scale=Math.min((stage.clientWidth-20)/w,(stage.clientHeight-20)/h,1);frame.style.width=w+'px';frame.style.height=h+'px';frame.style.transform=`translate(-50%,-50%) scale(${scale})`;}});$$('.usage-stage').forEach(s=>usageResize.observe(s));
$$('[data-copy-agent-context]').forEach(b=>b.addEventListener('click',()=>copy(componentContext(data.componentSpec,variantSelect?.value,location.origin)+`\nSelected brand mode: ${brandSelect?.value||'VNPT'}\n`)));
const bookmark=$('[data-bookmark]');if(bookmark){const key='ds-bookmark-'+location.pathname;bookmark.setAttribute('aria-pressed',String(localStorage.getItem(key)==='true'));bookmark.addEventListener('click',()=>{const v=bookmark.getAttribute('aria-pressed')!=='true';bookmark.setAttribute('aria-pressed',v);localStorage.setItem(key,String(v));toast(v?'Bookmarked':'Bookmark removed')})}
$$('[data-preview]').forEach(root=>{$$('[data-preview-tab]',root).forEach(b=>b.addEventListener('click',()=>{const value=b.dataset.previewTab;$$('[data-preview-tab]',root).forEach(x=>x.setAttribute('aria-selected',String(x===b)));$$('[data-panel]',root).forEach(x=>x.hidden=x.dataset.panel!==value)}))});
$$('[data-install]').forEach(root=>{$$('[data-install-tab]',root).forEach(b=>b.addEventListener('click',()=>{$$('[data-install-tab]',root).forEach(x=>x.setAttribute('aria-selected',String(x===b)));$$('[data-install-panel]',root).forEach(x=>x.hidden=x.dataset.installPanel!==b.dataset.installTab)}))});
for(const [input,rows]of[['[data-text-filter]','[data-text-row]'],['[data-component-filter]','[data-component-row]']]){$(input)?.addEventListener('input',e=>{$$(rows).forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(e.target.value.toLowerCase()))})}
function filterTokens(){const q=$('[data-token-filter]')?.value.toLowerCase()||'',mode=$('[data-mode-filter]')?.value;let count=0;$$('[data-token-row]').forEach(r=>{r.hidden=!!((mode&&r.dataset.mode!==mode)||!r.dataset.name.includes(q));if(!r.hidden)count++});if($('[data-token-count]'))$('[data-token-count]').textContent=count+' values'}
$('[data-token-filter]')?.addEventListener('input',filterTokens);$('[data-mode-filter]')?.addEventListener('change',filterTokens);filterTokens();
$$('[data-token]').forEach(b=>b.addEventListener('click',()=>{const t=data.tokens.find(t=>t.figmaVariableId===b.dataset.token&&t.mode===b.dataset.mode);if(!t)return;$('#token-detail').innerHTML=`<span class="tag">${escape(t.collection)} · ${escape(t.mode)}</span><h2>${escape(t.name)}</h2>${t.type==='color'?`<div class="big-swatch" style="--swatch:${cssValue(t)}"></div>`:''}<p>CSS mapping: <code>${escape(tokenVar(t))}</code></p>${codeBlock(JSON.stringify(t,null,2))}`;$('#token-dialog').showModal();$('[data-copy]',$('#token-detail'))?.addEventListener('click',()=>copy(JSON.stringify(t,null,2)))}));
$('[data-token-close]')?.addEventListener('click',()=>$('#token-dialog').close());
const menu=$('[data-menu]');menu.addEventListener('click',()=>{const v=$('#navigation').classList.toggle('open');menu.setAttribute('aria-expanded',v)});
const navGroups=$$('.nav-group');navGroups.forEach(group=>group.addEventListener('toggle',()=>{if(group.open)navGroups.forEach(other=>{if(other!==group)other.open=false})}));
const assetFilter=$('[data-asset-filter]');assetFilter?.addEventListener('input',()=>{const q=assetFilter.value.trim().toLowerCase();let visible=0;$$('[data-asset-row]').forEach(row=>{row.hidden=!row.dataset.name.includes(q);if(!row.hidden)visible++});$('[data-asset-count]').textContent=visible+' ảnh';$('.asset-empty').hidden=visible>0});
$$('[data-asset-download]').forEach(button=>button.addEventListener('click',async()=>{
 const asset=data.assets.find(a=>a.id===button.dataset.assetDownload);if(!asset)return;
 const scale=Number(button.dataset.scale),filename=asset.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)+'-'+asset.id.replace(':','-')+'@'+scale+'x.'+(asset.format==='jpg'?'jpg':'png');
 let blobURL;button.disabled=true;
 try{
  let url='/'+asset.path;
  if(scale!==asset.masterScale){
   const image=new Image();image.src=url;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale/asset.masterScale);canvas.height=Math.round(image.naturalHeight*scale/asset.masterScale);
   const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(image,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,asset.format==='jpg'?'image/jpeg':'image/png',0.95));if(!blob)throw Error('PNG encoding failed');
   blobURL=URL.createObjectURL(blob);url=blobURL;
  }
  const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();button.closest('details').open=false;toast('Đang tải '+(asset.format==='jpg'?'JPG':'PNG')+' '+scale+'×');
 }catch{toast('Không tải được ảnh. Vui lòng thử lại.')}finally{button.disabled=false;if(blobURL)setTimeout(()=>URL.revokeObjectURL(blobURL),30000)}
}));
const dialog=$('#search-dialog'),input=$('#search-input');let searchIndex,selected=0;
async function search(){if(!searchIndex){try{const r=await fetch('/data/search.json');if(!r.ok)throw Error(r.status);searchIndex=await r.json()}catch{$('#search-results').innerHTML='<p>Không tải được dữ liệu tìm kiếm. Hãy thử lại.</p>';return}}const q=input.value.trim().toLowerCase();const results=searchIndex.filter(r=>!q||(r.title+' '+r.group+' '+r.text).toLowerCase().includes(q)).sort((a,b)=>Number(b.title.toLowerCase().includes(q))-Number(a.title.toLowerCase().includes(q))).slice(0,24);selected=0;$('#search-results').innerHTML=results.length?results.map((r,i)=>`<a class="search-result" role="option" aria-selected="${i===0}" href="${r.route}"><strong>${escape(r.title)}</strong><span>${escape(r.group)} · ${escape(r.text.slice(0,95))}</span></a>`).join(''):'<p style="padding:16px">Không có kết quả.</p>'}
async function openSearch(){dialog.showModal();input.focus();await search()}
$('[data-search-open]').addEventListener('click',openSearch);$('[data-search-close]').addEventListener('click',()=>dialog.close());input.addEventListener('input',search);
input.addEventListener('keydown',e=>{const rows=$$('.search-result');if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();selected=Math.max(0,Math.min(rows.length-1,selected+(e.key==='ArrowDown'?1:-1)));rows.forEach((r,i)=>r.setAttribute('aria-selected',String(i===selected)));rows[selected]?.scrollIntoView({block:'nearest'})}if(e.key==='Enter'&&rows[selected]){e.preventDefault();location.href=rows[selected].href}});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();dialog.open?dialog.close():openSearch()}});
for(const d of [dialog,$('#token-dialog')])d.addEventListener('click',e=>{const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()});
const tocLinks=$$('.toc-tree a');const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){tocLinks.forEach(a=>a.classList.toggle('active',a.hash==='#'+e.target.id))}}, {rootMargin:'-90px 0px -60% 0px'});$$('.doc-section').forEach(s=>observer.observe(s));
// Legacy web preview interactions; not native Swift/Kotlin/Java implementations.
const live=$('[data-live]');
if(live&&data.live){const d=data.live;
 if(d.kind==='alert'){
  function renderAlert(){const type=$('[data-alert-type]').value;const idx=d.types.indexOf(type),multiple=type==='Multiple';const content=$('[data-alert-content]').value;const buttons=$('[data-alert-buttons]').checked;live.classList.toggle('multiple',multiple);$('.ds-alert-icon img',live).src=d.icons[idx];$('.ds-alert-content',live).textContent=content;$('.ds-chevron',live).hidden=!multiple;$('.ds-actions',live).hidden=!buttons;live.setAttribute('role',type==='Destructive'||type==='Warning'?'alert':'status')}
  $$('[data-alert-type],[data-alert-content],[data-alert-buttons]').forEach(e=>e.addEventListener('input',renderAlert));renderAlert();$$('.ds-action',live).forEach(b=>b.addEventListener('click',()=>toast('Demo: '+b.textContent.trim())));
 }
 if(d.kind==='toggle')live.addEventListener('click',()=>{const v=live.getAttribute('aria-checked')!=='true';live.setAttribute('aria-checked',String(v))});
 if(d.kind==='button')live.addEventListener('click',()=>toast('Demo: Button activated'));
}
