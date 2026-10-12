import json, re
from pathlib import Path
from collections import Counter
ROOT = Path(__file__).resolve().parent
FIGMA = ROOT / 'figma-audit'

def read_snapshot(page_id):
    semantic_key = 'semantic-' + page_id.replace(':','-') + '.json'
    compact_key = 'compact-' + page_id.replace(':','-') + '.json'
    candidates = [FIGMA/semantic_key, FIGMA/compact_key, FIGMA/'decoded'/compact_key, FIGMA/'compact'/compact_key]
    for path in candidates:
        if path.exists():
            data=json.loads(path.read_text())
            if data.get('schema') not in ['figma-doc-content-v1','figma-content-inventory-v1','figma-content-inventory-v2']:
                raise ValueError('Unsupported compact schema: '+str(path))
            if data.get('page',{}).get('id') != page_id:
                raise ValueError('Compact page identity mismatch: '+str(path))
            return data, str(path.relative_to(ROOT))
    return None, None

def compact_refs(snapshot):
    if not snapshot:return []
    if snapshot.get('schema') == 'figma-doc-content-v1':
        refs={n['id']:dict(n, parentId=snapshot['page']['id']) for n in snapshot.get('sections',[])}
        for n in snapshot.get('components',[]):refs[n['id']]=n
        return list(refs.values())
    rows=snapshot.get('nodeRows',[]); names=snapshot.get('names',[])
    return [{'id':r[0],'type':r[1],'name':names[r[2]],
             'parentId':rows[r[3]][0] if r[3]>=0 else snapshot['page']['id']}
            for r in rows]

def clean(name):
    return re.sub(r'^[^A-Za-z0-9]+', '', name).strip()
def slug(name):
    return re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-')
def ref(n): return {k:n[k] for k in ('id','name','type') if k in n}

discovery=json.loads((FIGMA/'discovery.json').read_text())
summary=json.loads((ROOT/'token-audit/summary.json').read_text())
fixed={
'6:4459': ('getting-started','overview','cover'),
'2042:741': ('guidelines-and-history','changelog','changelog'),
'10371:713': ('getting-started','table-of-contents','index'),
'11436:5': ('guidelines-and-history','adapting-liquid-glass','guideline'),
'11647:32064': ('assets','logo-app-icon','asset'),
'6144:2616': ('assets','store-screenshots','asset'),
'6:4693': ('foundations-and-tokens','styles-foundations','foundation'),
'10371:1556': ('foundations-and-tokens','spacing-radius-grids','foundation'),
'6:4698': ('assets','icons','asset'),
'6:4697': ('assets','illustrations','asset'),
'8550:11451': ('application','email-template','template'),
'21:21133': ('components','overview','index'),
'12834:4574': ('application','overview','index'),
'10352:33966': ('supplemental','sheets','supplemental'),
'11847:2471': ('supplemental','draft','draft')
}
active='getting-started'; pages=[]
for order,p in enumerate(discovery['pages'],1):
    pid=p['id']; name=p['name']
    if name.strip()=='---':
        group,route,kind='source-structure',pid.replace(':','-'),'separator'
    elif pid in fixed: group,route,kind=fixed[pid]
    elif name.lstrip().startswith('↳'):
        group=active; route=slug(clean(name)); kind='component' if group=='components' else 'application-component'
    else: raise ValueError('Unmapped source page: '+pid)
    if pid=='21:21133':active='components'
    if pid=='12834:4574':active='application'
    snapshot,evidence=read_snapshot(pid)
    nodes=compact_refs(snapshot)
    source_counts=snapshot.get('counts',{}) if snapshot else {}
    is_semantic=bool(snapshot and snapshot.get('schema')=='figma-doc-content-v1')
    source_status_evidence=([{'value':t['value'],'sourceNodeIds':t.get('nodes',[]),'sectionIds':t.get('sections',[]),
        'hiddenOnly':t.get('hiddenOnly'),'scope':'source-text-and-associated-sections',
        'interpretation':'source-label-only-does-not-approve-entire-page'}
        for t in snapshot.get('texts',[]) if t.get('value','').strip().upper() in ['COMPLETED','DRAFT','IN PROGRESS','NOT STARTED','READY']]
        if snapshot else [])
    entry={
      'sourceOrder':order,
      'source':{'fileKey':discovery['fileKey'],'pageId':pid,'pageName':name,'figmaUrl':'https://www.figma.com/design/'+discovery['fileKey']+'/-Mobile-App--Design-System?node-id='+pid.replace(':','-')},
      'group':group, 'pageKind':kind, 'displayName':clean(name) if kind!='separator' else '---',
      'route':'/sources/pages/'+route if kind=='separator' else '/docs/'+group+'/'+route,
      'navigationTreatment':'separator-preserved-in-source-inventory' if kind=='separator' else 'group-heading-and-overview' if kind=='index' else 'sidebar-page',
      'maturity':'draft' if kind=='draft' else 'unknown',
      'approvalEvidence':None,
      'sourceStatusEvidence':source_status_evidence,
      'standardUsePolicy':'explicit-draft-not-default-standard' if kind=='draft' else 'structural-only-preserve-any-contents' if kind=='separator' else 'preserve-source-and-do-not-infer-approval',
      'inventory':{'snapshotState':'complete' if snapshot else 'pending','evidence':evidence,'sourceSchema':snapshot.get('schema') if snapshot else None,
      'nodeCount':source_counts.get('nodes') if snapshot else None, 'nodeTypeCounts':source_counts.get('types') if snapshot else None,
      'sourceCounts':source_counts if snapshot else None,
      'bindingNodeCount':None if is_semantic else len(snapshot.get('bindings',[])) if snapshot else None,
      'variableUsageOccurrenceCount':sum(v.get('count',0) for v in snapshot.get('variables',{}).values()) if is_semantic else None,
      'sourceVariableIds':list(snapshot.get('variables',{})) if is_semantic else [],
      'fonts':snapshot.get('fonts') if snapshot else None,
      'sourceStyleIds':list(snapshot.get('styles',{}) if is_semantic else snapshot.get('styleUsage',{})) if snapshot else [],
      'uniquePlainTextValueCount':len(snapshot.get('texts',[])) if is_semantic else None,
      'capturedTextNodeReferenceCount':sum(len(t.get('nodes',[])) for t in snapshot.get('texts',[])) if is_semantic else None,
      'semanticTextCountMatchesSource':sum(len(t.get('nodes',[])) for t in snapshot.get('texts',[]))==source_counts.get('textNodes') if is_semantic else None,
      'semanticComponentCountMatchesSource':sum(c['type']=='COMPONENT' for c in snapshot.get('components',[]))==source_counts.get('components') if is_semantic else None,
      'semanticComponentSetCountMatchesSource':sum(c['type']=='COMPONENT_SET' for c in snapshot.get('components',[]))==source_counts.get('componentSets') if is_semantic else None,
      'semanticAssetCountMatchesSource':len(snapshot.get('assets',[]))==source_counts.get('imageFillNodes') if is_semantic else None,
      'assetExportState':'source-image-paint-references-native-export-pending' if is_semantic and snapshot.get('assets') else 'not-applicable-or-no-image-fills',
      'extractionErrors':snapshot.get('errors',[]) if snapshot else [],
      'topLevelNodeRefs':[ref(n) for n in nodes if n.get('parentId')==pid],
      'sectionRefs':[ref(n) for n in snapshot.get('sections',[]) if n.get('type')=='SECTION'] if is_semantic else [ref(n) for n in nodes if n.get('type')=='SECTION'],
      'componentSetRefs':[ref(n) for n in nodes if n.get('type')=='COMPONENT_SET']},
      'contentTemplate':'component' if kind in ['component','application-component'] else 'foundation' if kind=='foundation' else kind
    }
    pages.append(entry)

collection_route={
'_Global Colors':'primitive-colors','_Global Dimension':'primitive-dimensions',
'1. Color modes':'semantic-colors','2. Radius':'radius','3. Spacing':'spacing','4. Typography':'typography'
}
collections=[]
for source_col in discovery['collections']:
    token_col=next(c for c in summary['collections'] if c['name']==source_col['name'])
    collections.append({
       'sourceCollectionName':source_col['name'],'sourceCollectionId':source_col['id'],
       'sourceModes':source_col['modes'],'defaultModeId':source_col['defaultModeId'],
       'hiddenFromPublishingInFigma':source_col['hiddenFromPublishing'],
       'route':'/docs/foundations-and-tokens/'+collection_route[source_col['name']],
       'uniqueTokenCount':token_col['uniqueTokenCount'],'valueCount':token_col['valueCount'],
       'preserveAllTokens':True,'sourceTokenFiles':[f['sourceFile'] for f in summary['files'] if f['collection']==source_col['name']],
       'figmaContextPageIds':['6:4693','10371:1556'],
       'tokenIdentityFields':['collection','name','figmaVariableId'],
       'valueIdentityFields':['collection','mode','name'],
       'namingPolicy':'preserve-exact-source-case-whitespace-path',
       'descriptionPolicy':'retain-null-when-source-has-no-description'
    })

architecture={
 'schemaVersion':1,
 'phase':'step-2-content-inventory-and-proposed-architecture',
 'reference':{'site':'https://ui.spectrumhq.in/docs/alert','faqIncluded':False,'userApprovedDirection':'same-documentation-layout-and-sections-excluding-FAQ'},
 'sourceFileKey':discovery['fileKey'],
 'inventoryScope':'Step 2 semantic inventory includes all plain text values/source node and section associations, components/sets/variant definitions, component root formats, image-paint references and token/style usage counts/examples. Step 3 reads exact nodes for leaf geometry, rich text/hyperlinks, behavior and usable native asset exports before implementation/publication.',
 'sourceSnapshotPolicy':'The discovery page list is the coverage baseline. Pending page snapshots must be read before claiming full content extraction. Neither presence in a non-Draft page nor publication visibility implies approval.',
 'coverage':{'sourcePageCount':len(pages),'mappedPageCount':len(pages),'unmappedPageIds':[],
    'groups':dict(Counter(p['group'] for p in pages)), 'pageKinds':dict(Counter(p['pageKind'] for p in pages)),
    'completePageSnapshotsAtGeneration':sum(p['inventory']['snapshotState']=='complete' for p in pages),
    'pendingPageSnapshotIds':[p['source']['pageId'] for p in pages if p['inventory']['snapshotState']=='pending'],
    'sourceCounts':{k:sum((p['inventory'].get('sourceCounts') or {}).get(k,0) for p in pages) for k in ['nodes','components','componentSets','textNodes','imageFillNodes']},
    'sourceCountsExcludingDraft':{k:sum((p['inventory'].get('sourceCounts') or {}).get(k,0) for p in pages if p['maturity']!='draft') for k in ['nodes','components','componentSets','textNodes','imageFillNodes']},
    'semanticCountMismatchPageIds':[p['source']['pageId'] for p in pages if any(p['inventory'].get(k) is False for k in ['semanticTextCountMatchesSource','semanticComponentCountMatchesSource','semanticComponentSetCountMatchesSource','semanticAssetCountMatchesSource'])],
    'extractionErrorCount':sum(len(p['inventory'].get('extractionErrors',[])) for p in pages),
    'liveStyleCounts':{'textStyles':40,'paintStyles':30,'effectStyles':16,'gridStyles':1},
    'tokenCollections':6,'uniqueTokenCount':summary['uniqueTokenCount'],'tokenValueCount':summary['tokenValueCount']},
 'navigationGroups':[
 {'id':'getting-started','label':'Getting Started','purpose':'Overview and source table of contents; implementation/agent guide is separately authored and identified as such.'},
 {'id':'foundations-and-tokens','label':'Foundations / Tokens','purpose':'Figma foundation documentation, all six exact token collections, typography and effects from style inventory.'},
 {'id':'assets','label':'Assets','purpose':'Logo, app icon, store screenshots, icons and illustrations; keep native sources and downloads if available.'},
 {'id':'components','label':'Components','purpose':'Source overview plus all 34 source component pages in original order.'},
 {'id':'application','label':'Application','purpose':'Application component overview, six source application component pages and Email Template.'},
 {'id':'guidelines-and-history','label':'Guidelines / Changelog','purpose':'Liquid Glass adaptation and source change history.'},
 {'id':'supplemental','label':'Supplemental','purpose':'Sheets and Draft remain available with explicit source maturity.'},
 {'id':'source-structure','label':'Source Structure','purpose':'All five separators are preserved as source records, including any nodes they actually contain.'}],
 'pages':pages,
 'tokenCollections':collections,
 'templates':{
 'component':{'orderedSections':['Title and description','Preview / examples / variants','Installation','Usage','Overview','Technology','Props / API','Use cases','Accessibility','Customization','Related components'],
  'sourceSpecificAdditions':['Token bindings and exact source token names','Anatomy, dimensions, spacing, radius, typography, effects','States, variants, property definitions and slots','Source links, page/node IDs, source maturity and version'],
  'faqIncluded':False,
  'evidencePolicy':'Each normative rule must point to source text or node properties; missing evidence stays unknown. Do not invent Installation, Technology, Props/API or accessibility behavior from visual nodes alone. Author implementation guidance separately and label it.'},
 'foundation':{'orderedSections':['Title and source description','Preview and scale','Exact names and values','Modes','Alias target and resolved values','Usage scopes and source bindings','Figma source references and status'],
   'allTokensIncluded':True,'sameValueTokensCollapsed':False,
   'rawNumericUnitPolicy':'ZIP numbers have no explicit unit; CSS/platform unit conversion must be declared as implementation mapping unless source context provides evidence.'}
 },
 'agentContractProposal':{
   'indexes':['/llms.txt','/llms-full.txt','/registry.json'],
   'perItemMachineData':['exact source name and identifier','source page/node references','maturity and evidence','variants/states/property definitions','token bindings and mode values','normative source facts','separately marked implementation guidance'],
   'tokenDownloads':['original token JSON files','normalized JSON with retained aliases and identities','CSS / platform mappings labeled as generated'],
   'defaultRetrievalPolicy':'Draft is explicit opt-in; unknown approval is preserved. Do not silently make exploratory Draft content a standard.',
   'publicAccessPolicy':'Content and machine-readable exports can be read without login.'
 },
 'sourceAuditNotes':[
 '7 JSON token files from 6 collections; counts match user screenshot.',
 '222 alias values resolve by explicit collection name and variable name; no missing target or value mismatch. Exact target IDs differ from local exported IDs and must remain unchanged.',
 '86 semantic color identities exist in both VNPT and VIBE CLUB; 66 values change and 20 do not. Modes are named VNPT/VIBE CLUB; do not relabel them simply Light/Dark.',
 '250 primitive colors hidden from publishing remain in documentation because the user requested the entire system and aliases depend on them.',
 '57 equal-value groups remain separate named identities.',
 'All ZIP token descriptions are absent; source-backed usage documentation must come from Figma.',
 'No custom domain or deployment choice is made in step 2; later publishing is explicitly Vercel.'
 ],
 'generatedFrom':['work/figma-audit/discovery.json','work/token-audit/summary.json','work/token-audit/collections.json','work/token-audit/alias-audit.json','work/token-audit/tokens.normalized.json']
}
(ROOT/'content-architecture.json').write_text(json.dumps(architecture,ensure_ascii=False,indent=2))
print(json.dumps(architecture['coverage'],ensure_ascii=False,indent=2))
