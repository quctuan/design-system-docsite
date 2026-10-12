import fs from 'node:fs';
import path from 'node:path';
const packet=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const root=path.resolve(import.meta.dirname,'..');
const results=[];
if(packet.records.length!==packet.images.length)throw Error('Export count mismatch');
packet.records.forEach((record,i)=>{
 const bytes=Buffer.from(packet.images[i],'base64');
 if(bytes.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('Invalid PNG '+record.id);
 const target=path.join(root,'public',record.path);
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
 results.push({...record,pixelWidth:bytes.readUInt32BE(16),pixelHeight:bytes.readUInt32BE(20),bytes:bytes.length});
});
fs.writeFileSync(process.argv[2]+'.metadata.json',JSON.stringify(results));
console.log(JSON.stringify({files:results.length,bytes:results.reduce((s,r)=>s+r.bytes,0)}));
