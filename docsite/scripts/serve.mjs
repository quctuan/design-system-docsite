import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
if(!process.argv.includes('--ipv6-only')&&!process.argv.includes('--no-build'))execFileSync(process.execPath,[path.join(root,'scripts/build.mjs')],{stdio:'inherit'});
const base=path.join(root,'dist');
const fallback404=fs.readFileSync(path.join(base,'404.html'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.zip':'application/zip','.tsx':'text/plain; charset=utf-8','.xml':'application/xml'};
const server=http.createServer((req,res)=>{try{let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return}let file=path.resolve(base,'.'+url);if(!file.startsWith(base+path.sep)&&file!==base){res.writeHead(403).end();return}if(url==='/')file=path.join(base,'index.html');if(!path.extname(file))file+='.html';if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(fallback404);return}const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Access-Control-Allow-Origin':'*'});stream.pipe(res)}catch{res.writeHead(503,{'Retry-After':'1'}).end('Preview rebuilding. Please reload.')}});
if(process.argv.includes('--ipv6-only'))server.listen(4173,'::1',()=>console.log('IPv6 Local: http://localhost:4173/docs/components/alert'));
else{
 server.listen(4173,'127.0.0.1',()=>console.log('Local: http://localhost:4173/docs/components/alert'));
 const ipv6=http.createServer(server.listeners('request')[0]);
 ipv6.on('error',error=>{if(error.code!=='EADDRINUSE')console.error('IPv6 preview unavailable:',error.code)});
 ipv6.listen(4173,'::1');
}
