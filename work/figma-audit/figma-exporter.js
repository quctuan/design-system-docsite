
const page=await figma.getNodeByIdAsync(PAGE_ID);await figma.setCurrentPageAsync(page);
const names=[],nameIndex=new Map(),textValues=[],textIndex=new Map(),formats=[],formatIndex=new Map(),bindingValues=[],bindingIndex=new Map(),rows=[],textRows=[],components=[],bindings=[],images=[],errors=[],styleUsage={},types={},fonts=new Map();
function intern(value,list,map){const key=typeof value==="string"?value:JSON.stringify(value);if(map.has(key))return map.get(key);const i=list.length;list.push(value);map.set(key,i);return i;}
function pick(n,ks){const o={};for(const k of ks){if(k in n){const v=n[k];if(typeof v!=="symbol"&&typeof v!=="function")o[k]=v;}}return o;}
function walk(n,parent,effectiveVisible){
 const index=rows.length; const vis=effectiveVisible&&n.visible;
 rows.push([n.id,n.type,intern(n.name,names,nameIndex),parent,n.x,n.y,n.width,n.height,n.visible,vis]);types[n.type]=(types[n.type]||0)+1;
 const bound=pick(n,["boundVariables","explicitVariableModes","resolvedVariableModes","componentPropertyReferences"]);
 if("fills"in n && Array.isArray(n.fills)){const b=n.fills.map((p,i)=>p.boundVariables?{paint:i,type:p.type,bindings:p.boundVariables}:null).filter(Boolean);if(b.length)bound.fills=b; const im=n.fills.filter(p=>p.type==="IMAGE");if(im.length)images.push([index,im]);}
 if("strokes"in n && Array.isArray(n.strokes)){const b=n.strokes.map((p,i)=>p.boundVariables?{paint:i,type:p.type,bindings:p.boundVariables}:null).filter(Boolean);if(b.length)bound.strokes=b;}
 const meaningful=Object.values(bound).some(v=>v&&Object.keys(v).length>0);if(meaningful)bindings.push([index,intern(bound,bindingValues,bindingIndex)]);
 for(const k of ["fillStyleId","strokeStyleId","effectStyleId","textStyleId","gridStyleId"]){if(k in n && typeof n[k]==="string"&&n[k]){const id=n[k];styleUsage[id]??={fields:{},count:0};styleUsage[id].fields[k]=(styleUsage[id].fields[k]||0)+1;styleUsage[id].count++;}}
 if(n.type==="TEXT"){
 const fmt=pick(n,["fontName","fontSize","fontWeight","lineHeight","letterSpacing","textStyleId","textAlignHorizontal","textAlignVertical","textAutoResize","textCase","textDecoration","paragraphSpacing","paragraphIndent","fills"]);
 const seg=n.getStyledTextSegments(["fontName","fontSize","fontWeight","lineHeight","letterSpacing","textStyleId","fills","hyperlink"]);
 if(seg.length>1 || seg.some(s=>s.hyperlink))fmt.segments=seg;
 for(const s of seg)fonts.set(JSON.stringify(s.fontName),s.fontName);
 textRows.push([index,intern(n.characters,textValues,textIndex),intern(fmt,formats,formatIndex)]);
 }
 if(n.type==="COMPONENT"||n.type==="COMPONENT_SET"){
 const c={nodeIndex:index,id:n.id,name:n.name,type:n.type,parentId:n.parent?n.parent.id:null,...pick(n,["key","description","descriptionMarkdown","variantProperties","fills","strokes","strokeWeight","strokeAlign","effects","cornerRadius","cornerSmoothing","topLeftRadius","topRightRadius","bottomLeftRadius","bottomRightRadius","layoutMode","layoutWrap","itemSpacing","counterAxisSpacing","paddingTop","paddingRight","paddingBottom","paddingLeft","primaryAxisAlignItems","counterAxisAlignItems","primaryAxisSizingMode","counterAxisSizingMode","layoutSizingHorizontal","layoutSizingVertical","clipsContent","minWidth","maxWidth","minHeight","maxHeight","layoutGrids","exportSettings","reactions"])};
 c.width=n.width;c.height=n.height;
 if(n.type==="COMPONENT_SET"||n.parent.type!=="COMPONENT_SET"){try{c.componentPropertyDefinitions=n.componentPropertyDefinitions;}catch(e){c.propertyError=String(e);errors.push({id:n.id,name:n.name,field:"componentPropertyDefinitions",message:String(e)});}}
 if(n.type==="COMPONENT_SET")c.variantGroupProperties=n.variantGroupProperties;
 components.push(c);
 }
 if(n.type==="INSTANCE"){try{n.componentProperties;}catch(e){errors.push({id:n.id,name:n.name,field:"componentProperties",message:String(e)});}}
 if("children"in n)for(const child of n.children)walk(child,index,vis);
}
for(const n of page.children)walk(n,-1,true);
const result={schema:"figma-content-inventory-v1",page:{id:page.id,name:page.name,...pick(page,["backgrounds","explicitVariableModes","resolvedVariableModes"])},topLevel:page.children.map(n=>({id:n.id,type:n.type,name:n.name,x:n.x,y:n.y,width:n.width,height:n.height,visible:n.visible})),counts:{nodes:rows.length,types,components:components.filter(c=>c.type==="COMPONENT").length,componentSets:components.filter(c=>c.type==="COMPONENT_SET").length,textNodes:textRows.length,uniqueTextValues:textValues.length,imageFillNodes:images.length},names,textValues,textFormats:formats,nodeRows:rows,textRows,components,bindingValues,bindings,images,styleUsage,fonts:[...fonts.values()],errors};
const componentFormats=[],componentFormatMap=new Map(),componentRows=[];
for(const c of result.components){
 const fmt={...c};for(const key of ["id","nodeIndex","name","type","parentId","key","description","descriptionMarkdown","variantProperties","width","height"])delete fmt[key];
 componentRows.push([c.nodeIndex,c.key,c.description,c.descriptionMarkdown,c.variantProperties,c.width,c.height,intern(fmt,componentFormats,componentFormatMap)]);
}
result.componentFormats=componentFormats;result.componentRows=componentRows;delete result.components;result.schema="figma-content-inventory-v2";
function encodeLzw16(s) {
 const src=unescape(encodeURIComponent(s));
 if(!src.length)return {data:"",byteLength:0,checksum:1};
 let a=1,b=0;for(let i=0;i<src.length;i++){a=(a+src.charCodeAt(i))%65521;b=(b+a)%65521;}
 let dict=new Map(),next=257,w=src[0],out=[];
 function push(code){out.push(String.fromCharCode((code>>8)&255,code&255));}
 for(let i=1;i<src.length;i++){
  const c=src[i],wc=w+c;
  if(dict.has(wc))w=wc;
  else{
   push(w.length===1?w.charCodeAt(0):dict.get(w));
   if(next<65536)dict.set(wc,next++);
   else{push(256);dict=new Map();next=257;}
   w=c;
  }
 }
 push(w.length===1?w.charCodeAt(0):dict.get(w));
 return {data:btoa(out.join("")),byteLength:src.length,checksum:((b<<16)|a)>>>0};
}
const encoded=encodeLzw16(JSON.stringify(result));const size=18500,index=CHUNK_INDEX;
return {encoding:"lzw16-reset-utf8-base64",summary:result.counts,index,chunks:Math.ceil(encoded.data.length/size),byteLength:encoded.byteLength,checksum:encoded.checksum,data:encoded.data.slice(index*size,(index+1)*size)};

