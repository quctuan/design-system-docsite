const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const rgba=c=>`rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${c.a??1})`;
function paint(p){if(p.type==='SOLID')return rgba({...p.color,a:p.opacity??1});if(p.type==='GRADIENT_LINEAR'){const t=p.gradientTransform,angle=t?Math.atan2(t[1][0],t[0][0])*180/Math.PI+90:180;return `linear-gradient(${angle}deg,${p.gradientStops.map(s=>`${rgba(s.color)} ${s.position*100}%`).join(',')})`;}return null;}
export function sceneHTML(nodes,assets,instances,renderInstance){
 const byParent=new Map();for(const n of nodes){if(!byParent.has(n.parent))byParent.set(n.parent,[]);byParent.get(n.parent).push(n);}
 function render(n,parent){
  if(!n.visible)return '';
  const children=byParent.get(n.id)||[],asset=assets.find(a=>a.id===n.id),absolute=parent?.layoutMode==='NONE'||!parent?.layoutMode||n.layoutPositioning==='ABSOLUTE';
  const css=['position:'+(!parent?'relative':absolute?'absolute':'relative'),'flex-shrink:0',`width:${n.w}px`,`height:${n.h}px`];
  if(parent&&absolute)css.push(`left:${n.x}px`,`top:${n.y}px`);
  if(n.layoutMode&&n.layoutMode!=='NONE'){css.push('display:flex','flex-direction:'+(n.layoutMode==='VERTICAL'?'column':'row'),`gap:${n.itemSpacing||0}px`,`padding:${n.paddingTop||0}px ${n.paddingRight||0}px ${n.paddingBottom||0}px ${n.paddingLeft||0}px`,'align-items:'+({MIN:'flex-start',CENTER:'center',MAX:'flex-end'}[n.counterAxisAlignItems]||'stretch'),'justify-content:'+({MIN:'flex-start',CENTER:'center',MAX:'flex-end',SPACE_BETWEEN:'space-between'}[n.primaryAxisAlignItems]||'flex-start'));if(n.layoutSizingHorizontal==='FILL'&&parent?.layoutMode==='HORIZONTAL')css.push('flex:1 1 0%;min-width:0');}
  if(n.type==='ELLIPSE')css.push('border-radius:50%');else css.push(`border-radius:${n.cornerRadius||0}px`);
  if(n.clipsContent)css.push('overflow:hidden');if(n.opacity!==undefined)css.push('opacity:'+n.opacity);
  const bg=(n.fills||[]).filter(p=>p.visible!==false).map(paint).filter(Boolean);if(bg.length&&n.type!=='TEXT')css.push('background:'+bg.join(','));
  const stroke=(n.strokes||[]).find(p=>p.visible!==false&&p.type==='SOLID');if(stroke)css.push(`outline:${n.strokeWeight}px solid ${rgba(stroke.color)};outline-offset:-${n.strokeWeight}px`);
  const shadows=(n.effects||[]).filter(e=>e.visible!==false&&e.type==='DROP_SHADOW').map(e=>`${e.offset.x}px ${e.offset.y}px ${e.radius}px ${e.spread||0}px ${rgba(e.color)}`);if(shadows.length)css.push('box-shadow:'+shadows.join(','));
  if(asset&&n.h>0&&n.w>0){const img=`<img src="${asset.url}" alt="" ${asset.format==='PNG'?`style="width:${n.w}px;height:${n.h}px;object-fit:cover"`:'style="display:block"'}>`;return `<div data-node-id="${n.id}" style="${css.join(';')}">${img}</div>`;}
  if(n.type==='TEXT'){const font=n.font[0];css.push(`font: ${font.fontWeight} ${font.fontSize}px/${font.lineHeight.value||n.h}px 'SF Pro Display',-apple-system,sans-serif;white-space:pre-wrap;color:${paint(font.fills[0])||'#34404b'}`);return `<p data-node-id="${n.id}" style="${css.join(';')}">${escape(n.text)}</p>`;}
  const instance=instances.find(i=>i.id===n.id);const child=instance?renderInstance(instance):children.map(c=>render(c,n)).join('');
  return `<div data-node-id="${n.id}" style="${css.join(';')}">${child}</div>`;
 }return render(nodes[0],null);
}
