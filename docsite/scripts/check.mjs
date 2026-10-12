import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {tokenVar} from '../src/templates.js';
const base=path.resolve(import.meta.dirname,'../dist');
const inventory=JSON.parse(fs.readFileSync(path.join(base,'data/inventory.json')));
const tokens=JSON.parse(fs.readFileSync(path.join(base,'data/tokens.json')));
const manifest=JSON.parse(fs.readFileSync(path.join(base,'build-manifest.json')));
assert.equal(tokens.length,506);assert.equal(new Set(tokens.map(t=>t.figmaVariableId)).size,420);
assert.equal(new Set(tokens.map(tokenVar)).size,420,'CSS names must retain separate identities');
assert.equal(manifest.textNodeReferences,6297);assert.equal(manifest.components,2126);
assert.equal(inventory.pages.length,60);
const errors=[];let pages=0;
function exists(url){const p=path.join(base,url.split(/[?#]/)[0]);return fs.existsSync(p)||fs.existsSync(p+'.html')||url==='/'}
for(const r of manifest.routes){
 const text=fs.readFileSync(path.join(base,r.slice(1)+'.html'),'utf8');pages++;
 assert(!/<h[12][^>]*>[^<]*FAQ/.test(text),'FAQ removed');
 assert(text.includes('<h1>'),'Page title');
 assert(!text.includes('class="agent-card"')&&!text.includes('class="snapshot"'),'Removed right rail blocks');
 const sidebar=text.match(/<aside class="sidebar"[\s\S]*?<\/aside>/)?.[0]||'';
 assert(!/Integrations|Guidelines &amp; History|Supplemental/.test(sidebar),'Removed sidebar sections');
 assert((sidebar.match(/name="docs-sections" open/g)||[]).length<=1,'Only one sidebar section open');
 for(const [,url] of text.matchAll(/(?:href|src)="(\/[^"\s]+)"/g))if(!exists(url))errors.push(r+' -> '+url);
 const data=JSON.parse(text.match(/<script type="application\/json" id="page-data">([\s\S]*?)<\/script>/)[1]);
 assert(data.summary.tokenCount===420);
}
for(const f of fs.readdirSync(path.join(base,'assets'))){assert(fs.statSync(path.join(base,'assets',f)).size>0,'Empty asset '+f);if(f.endsWith('.svg'))assert(/<svg\b/.test(fs.readFileSync(path.join(base,'assets',f),'utf8')),'Invalid SVG '+f)}
for(const file of fs.readdirSync(path.join(base,'code'))){const code=fs.readFileSync(path.join(base,'code',file),'utf8');assert(!code.includes('https://www.figma.com/api/mcp/asset/'),'No temporary asset URLs');for(const [,url] of code.matchAll(/["'](\/assets\/[^"']+)["']/g))assert(exists(url),'Missing prototype asset '+url)}
assert.deepEqual(errors,[],'Local page/asset links must resolve');
const componentIndex=JSON.parse(fs.readFileSync(path.join(base,'data/component-index.json')));
assert.equal(componentIndex.length,40);
const variableRecords=new Map([...inventory.figmaVariables,...inventory.externalReferences.variables.map(r=>r.record),...inventory.externalReferences.aliasTargetVariables.map(r=>r.record)].filter(Boolean).map(v=>[v.id,v]));
let normalizedVariants=0,exactRootBindings=0;
for(const entry of componentIndex){
 const spec=JSON.parse(fs.readFileSync(path.join(base,entry.spec)));
 const source=inventory.pages.find(p=>p.source.pageId===spec.source.pageId);
 const actual=source.content.components.filter(c=>c.type==='COMPONENT');
 assert.deepEqual(spec.variants.map(v=>v.id),actual.map(c=>c.id),'No invented or lost variant tuples');
 const html=fs.readFileSync(path.join(base,entry.route.slice(1)+'.html'),'utf8');
 for(const id of ['installation','usage','overview','technologies','properties','use-cases','features','customization','token-bindings','source-reference','source-content','related-components','topic-guides'])assert(!html.includes(`id="${id}"`),'Remove obsolete component sections');
 for(const id of ['preview-variants','design-spec'])assert(html.includes(`id="${id}"`));
 assert(html.includes('data-preview-tab="preview"')&&html.includes('data-preview-tab="code"')&&html.includes('data-copy-component-prompt'),'Preview / Code / Copy Prompt retained');
 assert(!html.includes('@vnpt/')&&!html.includes('class="reference-preview"'),'No imaginary package or whole-component screenshot preview');
 assert.equal(spec.implementation.status,'design-spec-only');
 assert.equal(spec.implementation.ios.language,'Swift');assert.deepEqual(spec.implementation.android.languages,['Kotlin','Java']);
 for(const u of spec.usage)assert(source.content.texts.some(t=>t.value===u.text&&JSON.stringify(t.nodes)===JSON.stringify(u.sourceNodeIds)),'Usage is traceable to source text');
 for(const v of spec.variants){
  const c=actual.find(c=>c.id===v.id);
  assert.deepEqual(v.variantProperties,c.variantProperties||{});
  assert.deepEqual(v.rootSource,source.content.formats[c.format]);
  const cached=JSON.parse(fs.readFileSync(path.join(base,`data/component-variants/${spec.slug}/${v.id.replace(':','-')}.json`)));
  assert.equal(cached.id,v.id);assert.deepEqual(cached.bindings,v.bindings);
  for(const b of v.bindings){assert.equal(b.part,'Root');assert.equal(b.token.name,variableRecords.get(b.token.id)?.name||null);for(const m of b.token.modes){assert.equal(m.status,'resolved','All bound variable modes resolve');for(const a of m.aliasChain)assert.equal(a.name,variableRecords.get(a.id)?.name||null);}exactRootBindings++;}
  normalizedVariants++;
 }
 for(const url of Object.values(spec.downloads))assert(exists(url),'Downloadable design contract '+url);
 const assetManifest=JSON.parse(fs.readFileSync(path.join(base,entry.assets)));
 assert(exists(spec.preview.url),'Native preview present');
 assert(spec.preview.url.startsWith('/prototype-previews/'),'No screenshot selection backgrounds');
 for(const file of assetManifest.files)assert(exists(file.url),'Component asset reference');
}
assert.equal(normalizedVariants,571);
const alertSpec=JSON.parse(fs.readFileSync(path.join(base,'data/components/alert.json'))),neutral=alertSpec.variants.find(v=>v.id==='4:3780');
assert.equal(neutral.rootFields.find(r=>r.property==='layoutSizingVertical').value,'HUG');
assert.equal(neutral.bindings.find(b=>b.property==='itemSpacing').token.modes[0].value,12);
assert.equal(neutral.bindings.find(b=>b.property==='paddingLeft').token.modes.find(m=>m.name==='VNPT').value,16);
assert(alertSpec.notes.some(n=>n.type==='source-conflict'),'Preserve Alert usage conflict');
const logo=fs.readFileSync(path.resolve(base,'../../sources/vnpt-app-icon.png'));
assert.deepEqual(fs.readFileSync(path.join(base,'brand/vnpt-app-icon.png')),logo,'Use exact supplied logo');
assert.deepEqual(fs.readFileSync(path.join(base,'favicon.png')),logo,'Use exact supplied favicon');
const gallery=JSON.parse(fs.readFileSync(path.join(base,'data/asset-gallery.json')));
const coverage=JSON.parse(fs.readFileSync(path.join(base,'data/preview-coverage.json')));
assert.equal(coverage.components,40);assert.equal(coverage.cases,571);assert.deepEqual(coverage.issues,[]);assert.deepEqual(coverage.unknownUtilities,[]);
for(const entry of componentIndex){
 const spec=JSON.parse(fs.readFileSync(path.join(base,entry.spec))),preview=JSON.parse(fs.readFileSync(path.join(base,`data/previews/${spec.slug}.json`)));
 assert.deepEqual(preview.cases.map(c=>c.id),spec.variants.map(v=>v.id));
 for(const c of preview.cases){const source=fs.readFileSync(path.join(base,c.url),'utf8');assert(source.includes(`data-variant="${c.id}"`));assert(!source.includes('prototype-previews/')&&!source.includes('https://www.figma.com/api/mcp/asset/'));assert(source.includes('<style>')&&source.includes('<script>'));for(const file of c.files)assert(exists(file));}
}
assert.equal(gallery.pages.length,4);
let galleryImages=0;
for(const page of gallery.pages){
 const source=inventory.pages.find(p=>p.source.pageId===page.pageId);
 const html=fs.readFileSync(path.join(base,source.route.slice(1)+'.html'),'utf8');
 assert(!html.includes('id="source-content"')&&!html.includes('id="catalogue"')&&!html.includes('id="token-bindings"'),'Assets use a simple gallery');
 assert.equal((html.match(/data-asset-row/g)||[]).length,page.items.length);
 for(const image of page.items){assert(exists('/'+image.path)&&exists('/'+image.thumbnail),'Gallery image and thumbnail');assert(image.pixelWidth>0&&image.pixelHeight>0&&image.masterScale>0);galleryImages++;}
}
assert.equal(galleryImages,1379,'All gallery assets exported');
const result={pagesChecked:pages,sourcePages:60,tokens:420,values:506,textNodeReferences:6297,components:2126,componentDocs:40,normalizedVariants,codePreviews:coverage.cases,exactRootBindings,assets:manifest.localAssets,galleryImages,brokenInternalLinks:errors.length};
fs.writeFileSync(path.join(base,'qa.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
