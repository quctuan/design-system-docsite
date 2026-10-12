const page=await figma.getNodeByIdAsync(PAGE_ID);await figma.setCurrentPageAsync(page);
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object'){const r={};for(const k of Object.keys(v).sort())if(v[k]!==undefined)r[k]=canonical(v[k]);return r;}return v;}
function pick(n,ks){const r={};for(const k of ks)if(k in n){const v=n[k];if(typeof v!=='symbol'&&typeof v!=='function')r[k]=canonical(v);}return r;}
const counts={nodes:0,types:{},components:0,componentSets:0,textNodes:0,imageFillNodes:0};
const texts=[],textMap=new Map(),components=[],formats=[],formatMap=new Map(),assets=[],errors=[],variables={},styles={};
function intern(v,list,map){const s=JSON.stringify(canonical(v));if(map.has(s))return map.get(s);const i=list.length;list.push(v);map.set(s,i);return i;}
function aliases(v,n,field){if(!v||typeof v!=='object')return;if(v.type==='VARIABLE_ALIAS'){variables[v.id]??={count:0,fields:{},examples:[]};const o=variables[v.id];o.count++;o.fields[field]=(o.fields[field]||0)+1;if(o.examples.length<8)o.examples.push(n.id);return;}for(const k of Object.keys(v).sort())aliases(v[k],n,field);}
function walk(n,section,visible){counts.nodes++;counts.types[n.type]=(counts.types[n.type]||0)+1;visible=visible&&n.visible;
 if('boundVariables'in n)aliases(n.boundVariables,n,'boundVariables');
 for(const k of ['fills','strokes'])if(k in n&&Array.isArray(n[k]))for(const p of n[k])if(p.boundVariables)aliases(p.boundVariables,n,k);
 for(const k of ['fillStyleId','strokeStyleId','effectStyleId','textStyleId','gridStyleId'])if(k in n&&typeof n[k]==='string'&&n[k]){styles[n[k]]??={count:0,fields:{},examples:[]};const o=styles[n[k]];o.count++;o.fields[k]=(o.fields[k]||0)+1;if(o.examples.length<8)o.examples.push(n.id);}
 if(n.type==='TEXT'){counts.textNodes++;const s=n.characters;let i=textMap.get(s);if(i===undefined){i=texts.length;textMap.set(s,i);texts.push({value:s,nodes:[],sections:[],hiddenOnly:!visible});}const o=texts[i];o.nodes.push(n.id);if(!o.sections.includes(section))o.sections.push(section);o.hiddenOnly=o.hiddenOnly&&!visible;}
 if(n.type==='COMPONENT'||n.type==='COMPONENT_SET'){counts[n.type==='COMPONENT'?'components':'componentSets']++;const format=pick(n,['fills','strokes','strokeWeight','strokeAlign','effects','cornerRadius','cornerSmoothing','topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius','layoutMode','layoutWrap','itemSpacing','counterAxisSpacing','paddingTop','paddingRight','paddingBottom','paddingLeft','primaryAxisAlignItems','counterAxisAlignItems','primaryAxisSizingMode','counterAxisSizingMode','layoutSizingHorizontal','layoutSizingVertical','clipsContent','minWidth','maxWidth','minHeight','maxHeight','layoutGrids','exportSettings','reactions','boundVariables','explicitVariableModes']);
 const c={id:n.id,type:n.type,name:n.name,parentId:n.parent.id,section,width:n.width,height:n.height,visible,key:n.key,description:n.description,descriptionMarkdown:n.descriptionMarkdown,variantProperties:canonical(n.variantProperties),format:intern(format,formats,formatMap)};
 if(n.type==='COMPONENT_SET'||n.parent.type!=='COMPONENT_SET'){try{c.properties=canonical(n.componentPropertyDefinitions);}catch(e){errors.push({id:n.id,name:n.name,field:'componentPropertyDefinitions',message:String(e)});}}
 if(n.type==='COMPONENT_SET')c.variantGroups=canonical(n.variantGroupProperties);components.push(c);}
 if('fills'in n&&Array.isArray(n.fills)){const im=n.fills.filter(p=>p.type==='IMAGE');if(im.length){counts.imageFillNodes++;assets.push({id:n.id,name:n.name,section,width:n.width,height:n.height,visible,paints:canonical(im)});}}
 if(n.type==='INSTANCE')try{n.componentProperties;}catch(e){errors.push({id:n.id,name:n.name,field:'componentProperties',message:String(e)});}
 if('children'in n)for(const child of n.children)walk(child,section,visible);
}
const sections=page.children.map(n=>({id:n.id,name:n.name,type:n.type,width:n.width,height:n.height,visible:n.visible}));for(const n of page.children)walk(n,n.id,true);
const result=canonical({schema:'figma-doc-content-v1',page:{id:page.id,name:page.name},counts,sections,texts,components,formats,assets,variables,styles,errors});
const raw=JSON.stringify(result),src=unescape(encodeURIComponent(raw));let a=1,b=0;for(let i=0;i<src.length;i++){a=(a+src.charCodeAt(i))%65521;b=(b+a)%65521;}
PAKO_CODE
const packed=module.exports.deflate(src.split('').map(c=>c.charCodeAt(0)),{level:6});let binary='';for(let i=0;i<packed.length;i+=4096)binary+=String.fromCharCode(...packed.slice(i,i+4096));const encoded=btoa(binary),size=18500,index=CHUNK_INDEX;
return {encoding:'zlib-utf8-base64',summary:counts,index,chunks:Math.max(1,Math.ceil(encoded.length/size)),byteLength:src.length,checksum:((b<<16)|a)>>>0,data:encoded.slice(index*size,(index+1)*size)};
