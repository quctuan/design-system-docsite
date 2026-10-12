import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const work=path.resolve(root,'../work');
const targets=JSON.parse(fs.readFileSync(path.join(work,'asset-gallery-targets.json')));
const records=[...JSON.parse(fs.readFileSync(path.join(work,'gallery-export-logo-0.json.metadata.json')))];
for(const file of fs.readdirSync(path.join(work,'asset-exports')).filter(f=>f.endsWith('.metadata.json')))records.push(...JSON.parse(fs.readFileSync(path.join(work,'asset-exports',file))));
const byID=new Map(records.map(r=>[r.id,r]));
const pages=targets.map(p=>({pageId:p.pageId,name:p.name,items:p.items.map(target=>{
 const item=byID.get(target.id);if(!item)throw Error('Missing gallery export '+target.id);
 return {...item,thumbnail:item.path.replace(/@\dx\.(png|jpg|jpeg)$/,'-thumb.png')};
})}));
fs.writeFileSync(path.join(root,'source/asset-gallery.json'),JSON.stringify({schemaVersion:1,fileKey:'LEPP6mucy8IwApPlDQ7VAH',exportMethod:'Native Figma node exports; original PNG alpha and configured JPEG formats preserved; resolution multiplier recorded per asset',pages}));
console.log(JSON.stringify(pages.map(p=>({name:p.name,images:p.items.length}))));
