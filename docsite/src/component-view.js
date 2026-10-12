import {escape,icon,table,section,pageHeader,note,sourceLink,codeBlock} from './templates.js';
import {formatValue} from './component-spec.js';

function tokenCell(binding,brand){
 const t=binding.token,modes=t.modes.filter(m=>m.name===brand);
 const values=modes.length?modes:t.modes;
 return `<code class="break">${escape(t.name||t.id)}</code>${values.map(m=>`<span class="binding-value">${values.length>1?escape(m.name)+' · ':''}${escape(formatValue(m.value))}${m.status!=='resolved'?` <span class="tag">${escape(m.status)}</span>`:''}</span>${m.aliasChain.length?`<span class="binding-alias">→ ${escape(m.aliasChain.map(a=>[a.collection,a.name].filter(Boolean).join('/')).join(' → '))}</span>`:''}`).join('')}`;
}

export function renderVariantSpec(spec,id=spec.defaultVariantId,brand='VNPT'){
 const v=spec.variants.find(v=>v.id===id);
 if(!v)return '<p class="meta">Chưa có root specification trong snapshot.</p>';
 const corners=['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'];
 const cornerFields=v.rootFields.filter(r=>corners.includes(r.property));
 const cornerBindings=v.bindings.filter(b=>corners.includes(b.property));
 const sameCorners=cornerFields.length===4&&cornerFields.every(r=>r.value===cornerFields[0].value)&&(!cornerBindings.length||(cornerBindings.length===4&&cornerBindings.every(b=>b.token.id===cornerBindings[0].token.id)));
 const fields=v.rootFields.filter(r=>{
  if(sameCorners&&corners.includes(r.property))return false;
  if(!sameCorners&&r.property==='cornerRadius'&&cornerFields.length)return false;
  if(r.property==='counterAxisSpacing'&&r.value===0)return false;
  if(r.property==='clipsContent'&&r.value===false)return false;
  if(r.property==='layoutWrap'&&r.value==='NO_WRAP')return false;
  if(r.property==='effects'&&Array.isArray(r.value)&&!r.value.length)return false;
  return true;
 });
 const rows=fields.map(r=>{
  const bindings=r.property==='cornerRadius'&&sameCorners&&cornerBindings.length?[cornerBindings[0]]:v.bindings.filter(b=>b.property===r.property);
  return [escape(r.label)+(r.sampleOnly?'<span class="binding-alias">Kích thước mẫu trong Figma</span>':''),`<code class="break">${escape(formatValue(r.value,r.unit))}</code>`,bindings.length?bindings.map(b=>tokenCell(b,brand)).join('<br>'):'<span class="meta">Literal</span>'];
 });
 const paintBindings=v.bindings.filter(b=>b.property.includes('.'));
 const properties=v.properties.map(p=>[escape(p.name),`<code>${escape(p.type)}</code>`,escape(v.variantProperties[p.sourceName]??p.defaultValue),p.variantOptions?.map(escape).join(' · ')||'—']);
 return `<div class="selected-variant"><div><span class="eyebrow">${escape(v.family)}</span><h3>${escape(v.name)}</h3></div>${sourceLink(v.id,'Variant in Figma')}</div>
 ${Object.keys(v.variantProperties).length?`<div class="chips variant-tuple">${Object.entries(v.variantProperties).map(([key,value])=>`<span>${escape(key)}: <strong>${escape(value)}</strong></span>`).join('')}</div>`:''}
 ${table(['Root property','Figma value',`Token · ${brand}`],rows)}
 ${paintBindings.length?`<details class="paint-binding-details"><summary>Paint & effect bindings · ${paintBindings.length}</summary>${table(['Root property','Token / resolved value'],paintBindings.map(b=>[`<code class="break">${escape(b.property)}</code>`,tokenCell(b,brand)]))}</details>`:''}
 ${properties.length?`<h3>Design properties</h3><p class="meta">Các thuộc tính trong Figma; tên gốc và ID được giữ trong file spec JSON.</p>${table(['Property','Type','Selected / default','Options'],properties)}`:''}`;
}

export function renderMobileComponent(p,I,spec){
 const first=spec.usage[0],long=first&&(first.text.includes('\n')||first.text.length>250);
 const lead=first?(long?first.text.split(/[\n\u2028]/)[0]:first.text):`${spec.variants.length} component variants từ Figma.`;
 const remaining=spec.usage.slice(long?0:1);
 const preview=spec.preview,codePreview=I.codePreviews[spec.slug],defaultCase=codePreview.cases.find(c=>c.id===spec.defaultVariantId);
 const toolbar=`<div class="component-actions"><a class="mini-button" href="${p.source.figmaUrl}" target="_blank" rel="noreferrer">${icon('figma',14)} Figma</a><a class="mini-button" href="${spec.downloads.spec}" download>${icon('download',13)} Spec JSON</a><details class="component-download"><summary class="mini-button">${icon('download',13)} Assets ${icon('chevron',12)}</summary><div class="component-download-menu">${preview?`<a href="${preview.url}" download>Preview PNG · Figma export</a>`:''}<a href="${spec.downloads.assets}" download>Asset manifest JSON</a><a href="${spec.downloads.rawSource}" download>Full source JSON</a><a href="${spec.downloads.context}" download>Agent context Markdown</a></div></details><button class="mini-button" data-copy-agent-context>${icon('copy',12)} Copy agent context</button></div>`;
 const previewBody=`<div data-preview class="component-code-preview"><div class="preview-toolbar"><div class="segmented" role="tablist" aria-label="Component preview"><button role="tab" data-preview-tab="preview" aria-selected="true" aria-controls="component-preview-panel">${icon('preview',15)} Preview</button><button role="tab" data-preview-tab="code" aria-selected="false" aria-controls="component-code-panel">${icon('code',15)} Code</button></div><button class="mini-button" data-copy-component-prompt disabled>${icon('copy',13)} Copy Prompt</button></div><div class="preview-panel live-preview-panel${spec.name==='Bottomsheet'?' bottomsheet-canvas':''}" data-panel="preview" id="component-preview-panel" role="tabpanel" style="height:${Math.max(452,Math.min(defaultCase.height+64,920))}px"><iframe data-component-frame title="${escape(spec.name)} live preview" src="${defaultCase.url}" class="live-preview-frame"></iframe></div><div class="code-panel" data-panel="code" id="component-code-panel" role="tabpanel" hidden><div data-component-code>${codeBlock('Đang tải code…','HTML · CSS · JavaScript')}</div><div class="code-links"><a class="source-link" data-download-preview href="${defaultCase.url}" download>${icon('download',13)} Download HTML source</a><a class="source-link" data-open-preview href="${defaultCase.url}" target="_blank">Open preview ${icon('external',12)}</a></div></div><p class="meta preview-code-note">Preview chạy từ đúng file HTML/CSS/JavaScript ở tab Code. iOS Swift · Android Kotlin/Java: dùng Design spec & Tokens bên dưới.</p></div>${toolbar}
 <div class="variant-picker"><label>Variant spec<select data-variant-select aria-label="Variant specification">${spec.variants.map(v=>`<option value="${escape(v.id)}"${v.id===spec.defaultVariantId?' selected':''}>${escape((spec.families.length>1?v.family+' · ':'')+v.name)}</option>`).join('')}</select></label><span class="meta">${spec.variants.length} actual variants</span></div>`;
 const usageGrid=codePreview.cases.length>1?section('usage-examples','Usage',`<div class="usage-toolbar"><input data-usage-filter type="search" placeholder="Tìm state, size, type…" aria-label="Filter usage states"><span class="meta" data-usage-count>${codePreview.cases.length} examples</span></div><div class="usage-grid">${codePreview.cases.map(c=>`<article class="usage-card" data-usage-case="${c.id}" data-name="${escape((c.family+' '+c.name).toLowerCase())}"><div class="usage-stage" style="background:${c.canvas}"><iframe class="usage-frame" title="${escape(c.family+' · '+c.name)}" src="${c.url}" loading="lazy" tabindex="-1" data-width="${c.width+64}" data-height="${Math.max(c.height+64,96)}"></iframe></div><div class="usage-label"><span>${escape(c.family)}</span><strong>${escape(c.name)}</strong><button class="source-link" data-select-example="${c.id}">${icon('code',12)} View code</button></div></article>`).join('')}</div><p class="meta usage-empty" hidden>Không tìm thấy state.</p>`):'';
 const usage=remaining.length?section('usage-behavior','Usage & Behavior',remaining.map(u=>`<div class="usage-rule"><p>${escape(u.text).replace(/[\n\u2028]/g,'<br>')}</p><a class="source-link" href="${u.figmaUrl}" target="_blank" rel="noreferrer">Figma source ${icon('external',12)}</a></div>`).join('')):'';
 const notes=spec.notes.map(n=>note(escape(n.text)+(n.sources?`<details><summary>Hai mô tả gốc</summary>${n.sources.map(s=>`<p>${escape(s.text)} <a class="source-link" href="${s.figmaUrl}" target="_blank" rel="noreferrer">Figma ${icon('external',12)}</a></p>`).join('')}</details>`:''),n.title)).join('');
 const design=`<div class="spec-heading"><p class="meta">Spec của component root. Width/height là kích thước mẫu; giữ đúng Fixed/Hug/Fill khi triển khai.</p><label class="brand-picker">Brand<select data-spec-brand aria-label="Token brand"><option>VNPT</option><option>VIBE CLUB</option></select></label></div><div data-variant-spec>${renderVariantSpec(spec)}</div><p class="spec-boundary">Đơn vị trên canvas: Figma px. Chính sách pt/dp/sp lấy từ dự án app. Chi tiết layer con và typography: <a class="subtle-link" data-selected-figma href="${spec.variants.find(v=>v.id===spec.defaultVariantId)?.figmaUrl||p.source.figmaUrl}" target="_blank" rel="noreferrer">xem variant trong Figma ${icon('external',12)}</a>.</p>${notes}`;
 const accessibility=spec.accessibility?section('accessibility','Accessibility',`<p class="meta">Hướng dẫn triển khai native · cần kiểm tra với VoiceOver / TalkBack trong app.</p><ul>${spec.accessibility.recommendations.map(r=>`<li>${escape(r)}</li>`).join('')}</ul><div class="a11y-sources">${spec.accessibility.sources.map(s=>`<a class="source-link" href="${s.url}" target="_blank" rel="noreferrer">${escape(s.title)} ${icon('external',12)}</a>`).join('')}</div>`):'';
 return pageHeader(spec.name,lead)+`<div class="component-meta"><span>iOS · Swift</span><span>Android · Kotlin, Java</span><span>Design spec · chưa có SDK native</span>${first&&!long?`<a class="source-link" href="${first.figmaUrl}" target="_blank" rel="noreferrer">Usage source ${icon('external',12)}</a>`:''}</div>`+section('preview-variants','Preview & Code',previewBody)+usageGrid+usage+section('design-spec','Design spec & Tokens',design)+accessibility;
}
