// A portable design contract, derived from the saved Figma snapshot.
// Native component APIs and child-layer mappings are deliberately not inferred.
const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const figmaURL = id => `https://www.figma.com/design/LEPP6mucy8IwApPlDQ7VAH/-Mobile-App--Design-System?node-id=${id.replaceAll(':','-')}`;
const labels = {
 width:'Sample width',height:'Sample height',layoutMode:'Layout direction',layoutSizingHorizontal:'Width behavior',layoutSizingVertical:'Height behavior',
 paddingTop:'Padding top',paddingRight:'Padding right',paddingBottom:'Padding bottom',paddingLeft:'Padding left',itemSpacing:'Item gap',counterAxisSpacing:'Cross-axis gap',
 primaryAxisAlignItems:'Main-axis alignment',counterAxisAlignItems:'Cross-axis alignment',layoutWrap:'Wrap',cornerRadius:'Corner radius',
 topLeftRadius:'Top-left radius',topRightRadius:'Top-right radius',bottomLeftRadius:'Bottom-left radius',bottomRightRadius:'Bottom-right radius',
 minWidth:'Minimum width',maxWidth:'Maximum width',minHeight:'Minimum height',maxHeight:'Maximum height',strokeWeight:'Border width',strokeAlign:'Border alignment',
 opacity:'Opacity',clipsContent:'Clip content',fills:'Background',strokes:'Border paint',effects:'Effects'
};
const lengths = new Set(['width','height','paddingTop','paddingRight','paddingBottom','paddingLeft','itemSpacing','counterAxisSpacing','cornerRadius','topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius','minWidth','maxWidth','minHeight','maxHeight','strokeWeight']);

export function formatValue(value,unit=null){
 if(value==null)return '—';
 if(typeof value==='number')return `${Number(value.toFixed(3))}${unit?' '+unit:''}`;
 if(typeof value==='boolean')return value?'Yes':'No';
 if(typeof value==='string')return value;
 if(Array.isArray(value))return value.length?value.map(v=>formatValue(v)).join(' · '):'None';
 if(value.hex)return `${value.hex}${value.alpha!=null&&value.alpha<1?' · α '+Number(value.alpha.toFixed(3)):''}`;
 if('r' in value&&'g' in value&&'b' in value){const hex='#'+['r','g','b'].map(k=>Math.round(value[k]*255).toString(16).padStart(2,'0')).join('');return hex+(value.a!=null&&value.a<1?' · α '+Number(value.a.toFixed(3)):'');}
 if(value.type==='SOLID')return formatValue(value.color)+(value.opacity!=null&&value.opacity<1?' · opacity '+value.opacity:'');
 if(value.gradientStops)return `${value.type.replace('GRADIENT_','')} (${value.gradientStops.map(s=>`${Math.round(s.position*100)}% ${formatValue(s.color)}`).join(' → ')})`;
 if(value.type==='IMAGE')return 'Image fill';
 if(value.type)return value.type+(value.radius!=null?' · blur '+value.radius:'')+(value.color?' · '+formatValue(value.color):'');
 return JSON.stringify(value);
}

function resolver(I){
 const records=[...I.figmaVariables,...I.externalReferences.variables.map(x=>x.record),...I.externalReferences.aliasTargetVariables.map(x=>x.record)].filter(Boolean);
 const vars=new Map(records.map(v=>[v.id,v]));
 const collections=new Map(I.collections.map(c=>[c.sourceCollectionId,{name:c.sourceCollectionName,modes:c.sourceModes,defaultModeId:c.defaultModeId}]));
 for(const c of I.externalReferences.collections||[])if(c.record)collections.set(c.record.id,c.record);
 for(const item of [...I.externalReferences.variables,...I.externalReferences.aliasTargetVariables])if(item.record&&item.collectionMetadata)collections.set(item.record.variableCollectionId,item.collectionMetadata);
 function resolve(id,modeId,modeName,seen=[]){
  const v=vars.get(id),meta=v&&collections.get(v.variableCollectionId);
  if(!v||seen.includes(id))return {status:v?'cycle':'unresolved',value:null,aliasChain:[]};
  const entries=Object.keys(v.valuesByMode||{});
  const chosen=entries.includes(modeId)?modeId:meta?.modes?.find(m=>m.name===modeName&&entries.includes(m.modeId))?.modeId||meta?.defaultModeId||(entries.length===1?entries[0]:null);
  if(!chosen||!(chosen in v.valuesByMode))return {status:'mode-unresolved',value:null,aliasChain:[]};
  const value=v.valuesByMode[chosen];
  if(value?.type==='VARIABLE_ALIAS'){
   const next=vars.get(value.id),nextMeta=next&&collections.get(next.variableCollectionId);
   const result=resolve(value.id,chosen,modeName,[...seen,id]);
   return {...result,aliasChain:[{id:value.id,name:next?.name||null,collection:nextMeta?.name||null},...result.aliasChain]};
  }
  return {status:'resolved',value,aliasChain:[]};
 }
 return id=>{
  const v=vars.get(id),meta=v&&collections.get(v.variableCollectionId);
  if(!v)return {id,name:null,collection:null,type:null,modes:[],status:'unresolved'};
  return {id,name:v.name,collection:meta?.name||null,type:v.resolvedType,remote:!!v.remote,modes:Object.keys(v.valuesByMode).map(modeId=>{const name=meta?.modes?.find(m=>m.modeId===modeId)?.name||modeId;return {modeId,name,...resolve(id,modeId,name)};})};
 };
}

function bindingsAtRoot(format,lookup){
 const rows=[],seen=new Set();
 function walk(value,path){
  if(!value||typeof value!=='object')return;
  if(value.boundVariables)for(const [property,binding]of Object.entries(value.boundVariables)){
   const refs=Array.isArray(binding)?binding:[binding];
   refs.forEach((ref,i)=>{if(!ref?.id)return;const field=path?`${path}.${property}`:property,key=field+'|'+i+'|'+ref.id;if(seen.has(key))return;seen.add(key);rows.push({part:'Root',property:field,...(refs.length>1?{index:i}:{}),token:lookup(ref.id)});});
  }
  for(const [key,child]of Object.entries(value)){
   if(key==='boundVariables')continue;
   if(Array.isArray(child))child.forEach((item,i)=>walk(item,path?`${path}.${key}[${i}]`:`${key}[${i}]`));
   else if(child&&typeof child==='object')walk(child,path?`${path}.${key}`:key);
  }
 }
 walk(format,'');return rows;
}

const sourceRules={Bottomsheet:['Cấm lạm dụng Bottomsheet khi action chuyển tiếp quá 3 action, tránh đè lặp BTS lên nhau']};
const a11yRules={
 'Alert':['Đọc nội dung thông báo theo mức độ khẩn cấp; icon chỉ minh họa không cần đọc riêng. Nút hành động phải có nhãn thể hiện đúng hành động.'],
 'Avatar':['Nếu tên người dùng đã có bên cạnh, bỏ avatar trang trí khỏi thứ tự đọc. Nếu avatar là nút mở hồ sơ, đọc tên người dùng và hành động.'],
 'Buttons':['Nút chỉ có icon cần nhãn hành động. Thông báo trạng thái disabled và giữ vùng chạm đủ lớn khi icon nhỏ.'],
 'Circular Button':['Nhãn đọc phải mô tả hành động của nút, thay vì tên hình icon. Giữ vùng chạm độc lập với kích thước icon.'],
 'Toggle':['Đọc nhãn thiết lập cùng trạng thái bật/tắt. Chỉ tạo một điểm focus cho toàn bộ toggle và nhãn liên quan.'],
 'Checkbox & Radio Option':['Checkbox cần đọc trạng thái chọn/bỏ chọn. Radio cần đọc lựa chọn hiện tại và ngữ cảnh nhóm, bảo đảm một nhóm chỉ có một lựa chọn.'],
 'Inputs':['Liên kết nhãn, hint và lỗi với đúng trường nhập. Không dùng placeholder làm nhãn duy nhất; kiểm tra thứ tự focus và nội dung lỗi với VoiceOver/TalkBack.'],
 'Cell item':['Nhóm các thông tin của một hàng thành thứ tự đọc hợp lý. Nếu hàng có nhiều hành động độc lập, từng hành động phải có nhãn riêng.'],
 'Navigation Option':['Đọc tên đích đến của mỗi lựa chọn. Chevron trang trí không tạo một điểm focus riêng.'],
 'Divider':['Divider thuần trang trí không tạo điểm focus hoặc nhãn đọc.'],
 'Section Header':['Đánh dấu tiêu đề để người dùng trình đọc màn hình có thể điều hướng giữa các section. Nút phụ vẫn có nhãn hành động riêng.'],
 'Status':['Đọc trạng thái bằng nội dung chữ; màu hoặc chấm trạng thái không được là dấu hiệu duy nhất.'],
 'Badge':['Thông báo trạng thái hoặc số lượng bằng chữ khi badge mang thông tin. Tránh đọc lặp khi thông tin đã có trong nhãn của phần tử cha.'],
 'Pagination':['Đọc vị trí hiện tại và tổng số trang. Nếu chấm phân trang tương tác được, mỗi chấm phải có nhãn và trạng thái được chọn.'],
 'Progress Bar':['Cung cấp giá trị tiến trình và ý nghĩa của giá trị đó, ví dụ dung lượng đã dùng/còn lại; không chỉ thể hiện qua màu.'],
 'Skeleton Loading':['Thông báo trạng thái đang tải ở cấp vùng nội dung. Các khối skeleton trang trí không tạo hàng loạt điểm focus.'],
 'Tabs':['Đọc tên tab và trạng thái đang chọn. Nội dung sau khi đổi tab cần xuất hiện theo thứ tự đọc hợp lý.'],
 'Menu Bar':['Mỗi tab cần có nhãn và trạng thái được chọn. Icon trang trí đi cùng nhãn không đọc thêm lần nữa.'],
 'Top Navigation':['Nút quay lại, đóng và hành động trên thanh điều hướng phải có nhãn riêng; tiêu đề được nhận diện như một heading.'],
 'Bottomsheet':['Đặt tên truy cập cho vùng sheet và các nút đóng/hành động. Kiểm tra thứ tự focus khi mở và quay lại ngữ cảnh gọi khi đóng.'],
 'Popup':['Nội dung modal cần tiêu đề và hành động rõ ràng. Kiểm tra focus không đi vào nội dung bị che, rồi quay lại vị trí gọi khi đóng.'],
 'Contextual Menu':['Các mục menu cần nhãn hành động. Luồng mở và chọn menu phải thực hiện được qua trình đọc màn hình, kể cả khi thao tác gốc là nhấn giữ.'],
 'Tooltip':['Thông tin cần thiết trong tooltip cũng phải có trong nhãn hoặc hint truy cập; không phụ thuộc hoàn toàn vào nhấn giữ/hover.'],
 'Switch Languages':['Đọc tên đầy đủ của ngôn ngữ và trạng thái đang chọn; không chỉ dựa vào biểu tượng cờ.'],
 'Snackbar':['Đọc phản hồi và cung cấp hành động Undo có nhãn rõ ràng. Kiểm tra thời gian biến mất không khiến người dùng TalkBack/VoiceOver bỏ lỡ hành động.'],
 'Snack Message':['Kiểm tra thông báo ngắn được đọc kịp trước khi biến mất và không đọc lặp mỗi lần render.']
};
const accessibilitySources=[{title:'Apple · Accessibility',url:'https://developer.apple.com/design/human-interface-guidelines/accessibility'},{title:'Android · Accessibility principles (Views)',url:'https://developer.android.com/guide/topics/ui/accessibility/views/principles-views'}];

export function buildComponentSpec(p,I){
 const lookup=resolver(I),name=slug(p.displayName);
 const usage=p.content.texts.filter(t=>!t.hiddenOnly&&t.nodes.some(id=>id.endsWith(';10357:268'))).map(t=>({text:t.value,provenance:'figma-canvas',sourceNodeIds:t.nodes,figmaUrl:figmaURL(t.nodes[0])}));
 for(const rule of sourceRules[p.displayName]||[]){const t=p.content.texts.find(t=>t.value===rule);if(t)usage.push({text:t.value,provenance:'figma-canvas',sourceNodeIds:t.nodes,figmaUrl:figmaURL(t.nodes[0])});}
 const sets=p.content.components.filter(c=>c.type==='COMPONENT_SET');
 const components=p.content.components.filter(c=>c.type==='COMPONENT');
 const variants=components.map(c=>{
  const f=p.content.formats[c.format]||{},set=sets.find(s=>s.id===c.parentId);
  const properties=Object.entries(c.properties||set?.properties||{}).map(([sourceName,v])=>({name:sourceName.replace(/#\d+:\d+$/,''),sourceName,type:v.type,defaultValue:v.defaultValue,variantOptions:v.variantOptions||null}));
  const rootFields=Object.entries({width:c.width,height:c.height,...f}).filter(([key,value])=>key in labels&&value!=null).map(([property,value])=>({part:'Root',property,label:labels[property],value,unit:lengths.has(property)?'Figma px':null,sampleOnly:property==='width'||property==='height'}));
  const ownBindings=bindingsAtRoot(f,lookup);
  return {id:c.id,key:c.key,name:c.name,setId:set?.id||null,family:set?.name||c.name,variantProperties:c.variantProperties||{},properties,visible:c.visible!==false,description:c.description||null,figmaUrl:figmaURL(c.id),rootFields,bindings:ownBindings,rootSource:f};
 });
 const proto=I.prototypes?.[p.displayName];
 const gallery=I.visuals.filter(v=>v.pageId===p.source.pageId&&v.previewGroup==='variant-previews');
 // For the five pages formerly presented as web adapters, use the original Figma board.
 const image=proto?{url:proto.image,nodeId:proto.nodeId,width:proto.width,height:proto.height,scope:'representative-variant',figmaUrl:figmaURL(proto.nodeId)}:gallery[0]?{url:'/'+gallery[0].relativePath,nodeId:gallery[0].nodeId,width:gallery[0].image.width,height:gallery[0].image.height,scope:'source-board',figmaUrl:figmaURL(gallery[0].nodeId)}:null;
 const notes=[];
 if(p.displayName==='Alert')notes.push({type:'source-conflict',title:'Phạm vi sử dụng cần xác nhận',text:'Canvas mô tả thông báo trong phạm vi màn hình; description của component set lại ghi “mà ko phải context của màn hình”.',sources:[{text:usage[0]?.text,figmaUrl:usage[0]?.figmaUrl},{text:sets[0].description,figmaUrl:figmaURL(sets[0].id)}]});
 const wip=p.content.texts.filter(t=>/^(draft|wip|work in progress)$/i.test(t.value.trim()));
 if(p.maturity==='draft'||wip.length)notes.push({type:'maturity',title:'Draft / WIP',text:'Nguồn có nội dung Draft/WIP; cần xác nhận phạm vi đã được duyệt trước khi áp dụng.',sourceNodeIds:wip.flatMap(t=>t.nodes)});
 return {schemaVersion:2,kind:'mobile-component-design-specification',name:p.displayName,slug:name,route:p.route,snapshot:I.generatedAt,source:p.source,maturity:p.maturity,
  downloads:{spec:`/data/components/${name}.json`,context:`/context/${name}.md`,rawSource:`/data/pages/${p.source.pageId.replace(':','-')}.json`,assets:`/data/component-assets/${name}.json`},
  usage,notes,preview:image,defaultVariantId:variants.find(v=>v.id===proto?.nodeId)?.id||variants[0]?.id||null,
  families:sets.map(s=>({id:s.id,name:s.name,description:s.description||null,variantIds:variants.filter(v=>v.setId===s.id).map(v=>v.id)})),variants,
  implementation:{status:'design-spec-only',ios:{language:'Swift',framework:null,verifiedSource:null},android:{languages:['Kotlin','Java'],framework:null,verifiedSource:null}},
  accessibility:a11yRules[p.displayName]?{provenance:'docsite-implementation-guidance',nativeValidation:'not-verified-in-app',recommendations:a11yRules[p.displayName],sources:accessibilitySources}:null,
  coverage:{geometry:'component-root-only',childRoleMapping:'not-exported',dimensions:'Figma canvas pixels; sample dimensions are not fixed runtime constraints. Native pt/dp/sp scaling requires app policy.',bindings:'Exact root properties, paints and effects only. Page-wide references do not establish child roles.',variants:'Only existing COMPONENT records; no Cartesian expansion.',implementation:'No verified Swift, Kotlin or Java component source provided.'},
  pageDependencies:{scope:'whole-source-page-including-documentation-frames',variables:Object.keys(p.content.variables),styles:Object.keys(p.content.styles)}
 };
}

export function componentContext(spec,variantId=spec.defaultVariantId,origin=''){
 const v=spec.variants.find(v=>v.id===variantId);
 const url=p=>origin+p;
 return `# ${spec.name} — VNPT Design System\n\nRead ${url('/agents.md')} before implementation.\nTarget: iOS Swift; Android Kotlin/Java. Native framework and application sizing policy must come from the app repository.\nSpecification: ${url(spec.downloads.spec)}\nToken definitions: ${url('/data/tokens.json')}\nAssets manifest: ${url(spec.downloads.assets)}\nOriginal source: ${spec.source.figmaUrl}\nSnapshot: ${spec.snapshot}\n\n## Usage & behavior (Figma source)\n${spec.usage.map(u=>u.text+'\nSource: '+u.figmaUrl).join('\n\n')||'No usage rules were found in the source documentation.'}\n\n## Selected actual variant\n${v?`${v.family} · ${v.name}\nFigma ID: ${v.id}\nFigma: ${v.figmaUrl}\nVariant tuple: ${JSON.stringify(v.variantProperties)}\nDesign properties (not a native API): ${JSON.stringify(v.properties)}\n\n### Root design values\n${v.rootFields.map(r=>`- ${r.property}: ${formatValue(r.value,r.unit)}${r.sampleOnly?' (sample dimension; honor sizing behavior)':''}`).join('\n')}\n\n### Exact root bindings\n${v.bindings.map(b=>`- ${b.part}.${b.property} → ${b.token.collection||'unlisted collection'}/${b.token.name||b.token.id} [${b.token.id}]: ${b.token.modes.map(m=>`${m.name} = ${formatValue(m.value)}${m.aliasChain.length?' (alias '+m.aliasChain.map(a=>`${a.collection}/${a.name} [${a.id}]`).join(' → ')+')':''}${m.status!=='resolved'?' ['+m.status+']':''}`).join('; ')}`).join('\n')||'No bound variables on this component root.'}`:'No component root variant captured.'}\n\n## Source decisions\n${spec.notes.map(n=>n.title+': '+n.text+(n.sources?'\n'+n.sources.map(s=>s.text+'\n'+s.figmaUrl).join('\n'):'')).join('\n\n')||'No component-specific source conflict recorded.'}\n\n## Native accessibility guidance (authored; not validated in the app)\n${spec.accessibility?.recommendations.join('\n')||'No component-specific native accessibility guidance published.'}\n${spec.accessibility?.sources.map(s=>s.url).join('\n')||''}\n\n## Implementation boundaries\nThis is a design specification, not a published SDK or installable package. No verified native code is available. Do not use /code/*.tsx or /components/*.html as Swift/Kotlin/Java implementations.\nRoot geometry and exact root bindings only; child-layer typography and roles are not inferred from page-wide occurrences. Check the Figma node for child-layer details. Preserve source IDs, mode names and alias identities. Choose only actual variants listed in the specification. VNPT and VIBE CLUB are brand modes, not light/dark themes. Figma px are not automatically native pt/dp/sp.\n`;
}
