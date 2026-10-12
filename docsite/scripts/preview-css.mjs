// Translate Figma reference utilities to ordinary CSS; no Tailwind runtime.
export const unknown=new Set();
const extra={contents:'display:contents','flex-none':'flex:none','self-stretch':'align-self:stretch','mix-blend-luminosity':'mix-blend-mode:luminosity','mix-blend-plus-lighter':'mix-blend-mode:plus-lighter','text-ellipsis':'text-overflow:ellipsis','cursor-pointer':'cursor:pointer','border-b':'border-bottom-width:1px','not-italic':'font-style:normal','border-white':'border-color:white',uppercase:'text-transform:uppercase','text-white':'color:white','mask-alpha':'mask-mode:alpha','mask-intersect':'mask-composite:intersect','mask-no-clip':'mask-clip:no-clip','mask-no-repeat':'mask-repeat:no-repeat','-scale-y-100':'transform:scaleY(-1)'};
const simple={relative:'position:relative',absolute:'position:absolute',fixed:'position:fixed',block:'display:block',inline:'display:inline',flex:'display:flex',grid:'display:grid',hidden:'display:none','inline-flex':'display:inline-flex','flex-col':'flex-direction:column','flex-row':'flex-direction:row','flex-wrap':'flex-wrap:wrap','items-center':'align-items:center','items-start':'align-items:flex-start','items-end':'align-items:flex-end','items-stretch':'align-items:stretch','justify-center':'justify-content:center','justify-between':'justify-content:space-between','justify-end':'justify-content:flex-end','justify-start':'justify-content:flex-start','content-stretch':'align-content:stretch','shrink-0':'flex-shrink:0','shrink':'flex-shrink:1','grow':'flex-grow:1','grow-0':'flex-grow:0','flex-1':'flex:1 1 0%','overflow-clip':'overflow:clip','overflow-hidden':'overflow:hidden','overflow-auto':'overflow:auto','whitespace-nowrap':'white-space:nowrap','whitespace-pre-wrap':'white-space:pre-wrap','text-center':'text-align:center','text-left':'text-align:left','text-right':'text-align:right','object-cover':'object-fit:cover','object-contain':'object-fit:contain','pointer-events-none':'pointer-events:none','border-solid':'border-style:solid','border-dashed':'border-style:dashed','border-none':'border-style:none','border':'border-width:1px;border-style:solid','max-w-none':'max-width:none','min-w-px':'min-width:1px','min-h-px':'min-height:1px','rounded-full':'border-radius:999px','rounded-none':'border-radius:0','bg-transparent':'background:transparent','bg-black':'background:#000','bg-white':'background:#fff','bg-gradient-to-b':'background-image:linear-gradient(to bottom,var(--gradient-from),var(--gradient-to))','bg-gradient-to-r':'background-image:linear-gradient(to right,var(--gradient-from),var(--gradient-to))','isolate':'isolation:isolate','underline':'text-decoration:underline','italic':'font-style:italic','font-bold':'font-weight:700','font-medium':'font-weight:500','font-normal':'font-weight:400','box-border':'box-sizing:border-box'};
const props={w:['width'],h:['height'],size:['width','height'],'min-w':['min-width'],'min-h':['min-height'],'max-w':['max-width'],'max-h':['max-height'],p:['padding'],px:['padding-left','padding-right'],py:['padding-top','padding-bottom'],pt:['padding-top'],pb:['padding-bottom'],pl:['padding-left'],pr:['padding-right'],gap:['gap'],'gap-x':['column-gap'],'gap-y':['row-gap'],top:['top'],bottom:['bottom'],left:['left'],right:['right'],inset:['inset'],'inset-x':['left','right'],'inset-y':['top','bottom'],rounded:['border-radius'],'rounded-tl':['border-top-left-radius'],'rounded-tr':['border-top-right-radius'],'rounded-bl':['border-bottom-left-radius'],'rounded-br':['border-bottom-right-radius'],'rounded-t':['border-top-left-radius','border-top-right-radius'],'rounded-b':['border-bottom-left-radius','border-bottom-right-radius'],leading:['line-height'],tracking:['letter-spacing'],opacity:['opacity'],z:['z-index'],blur:['filter']};
export function declarations(classes){
 const list=classes.split(/\s+/).filter(Boolean),rules=[];let tx='0px',ty='0px',rotate='0deg';
 for(let c of list){
  // Escaped slashes in generated token names are normalized below.
  c=c.replace(/\\/g,'');
  if(simple[c]||extra[c]){rules.push(simple[c]||extra[c]);continue;}
  let m=c.match(/^(-?)([a-z][a-z-]*)-\[(.*)\]$/);
  if(m){let [,neg,k,v]=m;v=v.replace(/_/g,' ').replace(/(\d(?:%|px|rem|em|vh|vw))([+-])(?=[\d.])/g,'$1 $2 ');if(neg)v=`calc(${v} * -1)`;
   v=v.replace(/var\(--([^,]+),/g,(_,name)=>`var(--figma-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')},`);
   if(k==='font'&&(v.startsWith('family-name:')||v.startsWith("'"))){rules.push('font-family:"SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif');const w=v.match(/:(Bold|Medium|Semibold|Regular)/i)?.[1];if(w)rules.push('font-weight:'+({bold:700,medium:500,semibold:600,regular:400}[w.toLowerCase()]));continue;}
   if(k==='font'){rules.push('font-weight:'+v.replace(',normal)',',400)'));continue;}
   if(k==='text'){rules.push((v.startsWith('length:')?'font-size:':v.startsWith('color:')?'color:':/^(?:#|rgb|white|black)/.test(v)?'color:':'font-size:')+v.replace(/^(length|color):/,''));continue;}
   if(k==='bg'){rules.push('background:'+v);continue;}
   if(k==='border'){rules.push((/^\d/.test(v)?'border-width:':'border-color:')+v);continue;}
   if(k==='border-b'||k==='border-t'){rules.push(k.replace('border-b','border-bottom').replace('border-t','border-top')+'-width:'+v);continue;}
   if(k==='shadow'){rules.push('box-shadow:'+v);continue;}
   if(k==='drop-shadow'){rules.push('filter:drop-shadow('+v+')');continue;}
   if(k==='aspect'){rules.push('aspect-ratio:'+v);continue;}
   if(k==='mask-size'||k==='mask-position'){rules.push(k+':'+v);continue;}
   if(k==='skew-x'){rules.push('transform:skewX('+v+')');continue;}
   if(['mt','mr','mb','ml','mx','my','m'].includes(k)){const p={mt:['margin-top'],mr:['margin-right'],mb:['margin-bottom'],ml:['margin-left'],mx:['margin-left','margin-right'],my:['margin-top','margin-bottom'],m:['margin']}[k];rules.push(...p.map(p=>p+':'+v));continue;}
   if(k==='backdrop-blur'){rules.push('backdrop-filter:blur('+v+')');continue;}
   if(k==='flex'){rules.push('flex:'+v);continue;}
   if(k==='from'||k==='to'){rules.push(`--gradient-${k}:`+v);continue;}
   if(k==='translate-x'){tx=v;continue;}if(k==='translate-y'){ty=v;continue;}if(k==='rotate'){rotate=v;continue;}
   if(props[k]){rules.push(...props[k].map(p=>p+':'+(k==='blur'?'blur('+v+')':v)));continue;}
  }
  if(c.startsWith('[')&&c.endsWith(']')){rules.push(c.slice(1,-1).replace(/_/g,' '));continue;}
  m=c.match(/^(-?)([a-z][a-z-]*)-(full|auto|px|screen|none|\d+(?:\.\d+)?|\d+\/\d+)$/);
  if(m){let [,negative,k,n]=m;let v=n==='full'?'100%':n==='auto'?'auto':n==='px'?'1px':n==='none'?'none':n==='screen'?(k==='h'?'100vh':'100vw'):n.includes('/')?`${Number(n.split('/')[0])/Number(n.split('/')[1])*100}%`:`${Number(n)*4}px`;if(negative)v=`calc(${v} * -1)`;
   if(k==='translate-x'){tx=v;continue;}if(k==='translate-y'){ty=v;continue;}
   if(k==='rotate'){rotate=n+'deg';continue;}
   if(['mt','mr','mb','ml','mx','my','m'].includes(k)){const p={mt:['margin-top'],mr:['margin-right'],mb:['margin-bottom'],ml:['margin-left'],mx:['margin-left','margin-right'],my:['margin-top','margin-bottom'],m:['margin']}[k];rules.push(...p.map(p=>p+':'+v));continue;}
   if(k==='border'){rules.push('border-width:'+n+'px');continue;}
   if(k==='border-b'||k==='border-t'){rules.push(k.replace('border-b','border-bottom').replace('border-t','border-top')+'-width:'+n+'px');continue;}
   if(props[k]){rules.push(...props[k].map(p=>p+':'+(k==='leading'&&n==='0'?'0':k==='opacity'?Number(n)/100:k==='z'?n:v)));continue;}
  }
  if(c==='from-white'){rules.push('--gradient-from:white');continue;}if(c==='to-white'){rules.push('--gradient-to:white');continue;}
  unknown.add(c);
 }
 if(tx!=='0px'||ty!=='0px'||rotate!=='0deg')rules.push(`transform:translate(${tx},${ty}) rotate(${rotate})`);
 return rules.join(';');
}
