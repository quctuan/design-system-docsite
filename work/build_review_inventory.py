"""Build the complete Step 2 review inventory from decoded, validated sources."""
import hashlib
import json
import shutil
import struct
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work'
FIGMA = WORK / 'figma-audit'
OUTPUTS = ROOT / 'outputs'
PREVIEWS = OUTPUTS / 'source-previews'


def read_json(path):
    return json.loads(path.read_text())


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def image_dimensions(path):
    with path.open('rb') as stream:
        header = stream.read(24)
    if header[:8] == b'\x89PNG\r\n\x1a\n' and len(header) >= 24:
        width, height = struct.unpack('>II', header[16:24])
        return {'width': width, 'height': height, 'format': 'png'}
    return {'format': path.suffix.lstrip('.').lower()}


def preview_metadata(raw):
    """Retain dimensions, without copying transient Figma asset URLs or tool text."""
    value = raw.get('metadata')
    if isinstance(value, str):
        try:
            value = json.loads(value.splitlines()[0])
        except (json.JSONDecodeError, IndexError):
            value = {}
    if not isinstance(value, dict):
        value = {}
    return {key: value[key] for key in
            ('width', 'height', 'format', 'original_width', 'original_height')
            if key in value}


def load_previews():
    manifests = [FIGMA / 'visual-previews.json',
                 FIGMA / 'supplementary-previews.json',
                 FIGMA / 'variant-previews.json']
    visuals, errors, used_manifests = [], [], []
    copied = {}
    for manifest in manifests:
        if not manifest.exists():
            continue
        data = read_json(manifest)
        entries = data.get('successful', []) if isinstance(data, dict) else data
        if isinstance(data, dict):
            errors.extend({'manifest': manifest.name, 'error': item}
                          for item in data.get('errors', []))
        used_manifests.append(manifest.name)
        for entry in entries:
            source = Path(entry['path'])
            if not source.is_absolute():
                source = ROOT / source
            assert source.is_file(), f'Missing preview: {source}'
            digest = sha256(source)
            destination = PREVIEWS / source.name
            if destination.name in copied and copied[destination.name] != digest:
                destination = PREVIEWS / f'{source.stem}-{digest[:12]}{source.suffix}'
            copied[destination.name] = digest
            if not destination.exists() or sha256(destination) != digest:
                shutil.copy2(source, destination)
            relative = destination.relative_to(OUTPUTS).as_posix()
            record = {key: value for key, value in entry.items()
                      if key not in ('path', 'metadata', 'relpath', 'relativePath')}
            record.update({'path': relative, 'relpath': relative,
                           'relativePath': relative,
                           'previewGroup': manifest.stem,
                           'representative': True,
                           'previewScope': 'representative-source-node-screenshot',
                           'metadata': preview_metadata(entry),
                           'image': image_dimensions(destination),
                           'byteLength': destination.stat().st_size,
                           'sha256': digest})
            visuals.append(record)
    return visuals, errors, used_manifests


def main():
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    architecture = read_json(WORK / 'content-architecture.json')
    discovery = read_json(FIGMA / 'discovery.json')
    normalized = read_json(WORK / 'token-audit' / 'tokens.normalized.json')
    token_summary = read_json(WORK / 'token-audit' / 'summary.json')
    live = read_json(FIGMA / 'styles-variables.json')
    token_findings = read_json(WORK / 'token-audit' / 'review-findings.json')
    component_findings = read_json(FIGMA / 'component-review-findings.json')
    guideline_path = FIGMA / 'guideline-context.json'
    guideline_context = read_json(guideline_path) if guideline_path.exists() else None

    expected_counts = {'nodes': 59109, 'textNodes': 6297,
                       'components': 2126, 'componentSets': 455,
                       'imageFillNodes': 1278}
    totals = {key: 0 for key in expected_counts}
    source_page_ids = [page['id'] for page in discovery['pages']]
    pages, checks, source_errors = [], [], []
    for page in architecture['pages']:
        page_id = page['source']['pageId']
        content = read_json(FIGMA / f"semantic-{page_id.replace(':', '-')}.json")
        assert content['schema'] == 'figma-doc-content-v1', page_id
        assert content['page']['id'] == page_id, page_id
        assert content['page']['name'] == page['source']['pageName'], page_id
        counts = content['counts']
        page_checks = {
            'textNodeReferences': sum(len(text['nodes']) for text in content['texts']) == counts['textNodes'],
            'componentRecords': sum(item['type'] == 'COMPONENT' for item in content['components']) == counts['components'],
            'componentSetRecords': sum(item['type'] == 'COMPONENT_SET' for item in content['components']) == counts['componentSets'],
            'imageFillRecords': len(content['assets']) == counts['imageFillNodes'],
            'nodeTypeTotals': sum(counts['types'].values()) == counts['nodes'],
        }
        assert all(page_checks.values()), f'Semantic count mismatch: {page_id}'
        assert page['maturity'] == 'draft' if page_id == '11847:2471' else page['maturity'] != 'approved', page_id
        for key in totals:
            totals[key] += counts[key]
        source_errors.extend(dict(error, pageId=page_id, pageName=content['page']['name'])
                             for error in content.get('errors', []))
        checks.append({'pageId': page_id, **page_checks})
        pages.append(dict(page, content=content))

    assert len(pages) == 60
    assert [page['source']['pageId'] for page in pages] == source_page_ids
    assert len(set(source_page_ids)) == 60
    assert totals == expected_counts, (totals, expected_counts)
    assert architecture['reference']['faqIncluded'] is False
    tokens = normalized['tokens']
    identities = {(item['collection'], item['name']) for item in tokens}
    assert len(identities) == 420
    assert len(tokens) == 506
    assert sum(bool(item.get('alias')) for item in tokens) == 222
    assert len(architecture['tokenCollections']) == 6
    styles = {'text': live['textStyles'], 'paint': live['paintStyles'],
              'effect': live['effectStyles'], 'grid': live['gridStyles']}
    style_counts = {key: len(value) for key, value in styles.items()}
    assert style_counts == {'text': 40, 'paint': 30, 'effect': 16, 'grid': 1}
    assert len(live['variables']) == 420
    assert sum(page['pageKind'] == 'component' for page in pages) == 34
    assert sum(page['pageKind'] == 'application-component' for page in pages) == 6

    guideline_validation = None
    if guideline_context is not None:
        rules = guideline_context.get('rules', [])
        assert len(rules) == 12
        assert sum(rule['polarity'] == 'do' for rule in rules) == 6
        assert sum(rule['polarity'] == 'dont' for rule in rules) == 6
        text_by_node = {node_id: text['value'] for page in pages
                        for text in page['content']['texts'] for node_id in text['nodes']}
        assert all(all(node_id in text_by_node for node_id in rule['textNodeIds'])
                   for rule in rules)
        guideline_validation = {'ruleCount': 12, 'doCount': 6, 'dontCount': 6,
                                'allSourceTextNodeReferencesExist': True,
                                'polarityEvidence': 'source-visual-table-column-labels'}

    visuals, visual_errors, manifests = load_previews()
    assert not visual_errors, f'Unresolved preview capture errors: {visual_errors}'
    zip_source = Path(token_summary['sourceArchive'])
    assert zip_source.is_file(), f'Missing original token ZIP: {zip_source}'
    zip_destination = OUTPUTS / 'design-system-tokens-source.zip'
    if not zip_destination.exists() or sha256(zip_destination) != sha256(zip_source):
        shutil.copy2(zip_source, zip_destination)
    zip_digest = sha256(zip_destination)
    assert zip_digest == token_summary['sourceArchiveSha256']

    generated_at = datetime.now(timezone(timedelta(hours=7))).isoformat(timespec='seconds')
    validation = {
        'allChecksPassed': True,
        'sourcePageCoverage': '60/60',
        'counts': totals,
        'expectedCounts': expected_counts,
        'pageChecks': checks,
        'textNodeReferenceCount': totals['textNodes'],
        'uniqueTokenCount': len(identities),
        'tokenValueCount': len(tokens),
        'aliasValueCount': 222,
        'styleCounts': style_counts,
        'liveFigmaVariableCount': len(live['variables']),
        'guidelineContext': guideline_validation,
        'faqExcluded': True,
        'draftPageId': '11847:2471',
        'draftRemainsDraft': True,
        'sourceInstancePropertyGetterErrorCount': len(source_errors),
        'sourceInstancePropertyGetterErrors': source_errors,
        'previewCount': len(visuals),
        'previewPageCount': len({item['pageId'] for item in visuals}),
        'previewManifests': manifests,
        'previewScope': 'representative-source-node-screenshots-not-full-native-asset-export',
        'previewErrors': visual_errors,
        'allIncludedPreviewFilesExist': all((OUTPUTS / item['relpath']).is_file() for item in visuals),
        'tokenZipRelativePath': zip_destination.name,
        'tokenZipSha256': zip_digest,
        'tokenZipMatchesOriginal': True,
        'limitations': [
            '22 source instance componentProperties getter errors are retained; they do not omit plain text or component owner records.',
            'Semantic usage data keeps counts and example source node IDs; exact leaf bindings and runtime behavior require scoped Step 3 reads.',
            'IMAGE paint references and review screenshots are not complete native binary/vector asset exports.',
        ],
    }
    assert validation['allIncludedPreviewFilesExist']
    inventory = {
        'schemaVersion': 1,
        'phase': 'step-2-review',
        'generatedAt': generated_at,
        'source': {
            'fileKey': discovery['fileKey'],
            'figmaUrl': 'https://www.figma.com/design/LEPP6mucy8IwApPlDQ7VAH/-Mobile-App--Design-System?node-id=10373-36110',
            'tokenZipName': zip_source.name,
        },
        'scope': {'semanticInventory': True, 'notes': [
            'All plain texts and their source node references, component/set/variant catalogue and component root formats across all 60 source pages.',
            'Unique text values retain source node lists and value-level section reference sets; exact node-to-section pairing is not represented.',
            'The review inventory excludes full vector geometry, rich text/hyperlink export and complete native binary asset exports.',
            'Review screenshots are representative source-node previews; they do not export every native asset or every variant.',
            'Step 3 reads targeted source nodes for implementation details, hyperlinks/source association and usable asset exports.',
        ]},
        'summary': {
            'pageCount': 60, 'nodeCount': totals['nodes'],
            'textNodeCount': totals['textNodes'],
            'componentCount': totals['components'],
            'componentSetCount': totals['componentSets'],
            'imageFillNodeCount': totals['imageFillNodes'],
            'componentPageCount': 34, 'applicationPageCount': 6,
            'tokenCount': 420, 'tokenValueCount': 506,
            'aliases': 222, 'styleCount': 87,
        },
        'pages': pages,
        'tokens': tokens,
        'figmaVariables': live['variables'],
        'styles': styles,
        'collections': architecture['tokenCollections'],
        'architecture': architecture,
        'findings': {'tokens': token_findings, 'components': component_findings},
        'visuals': visuals,
        'validation': validation,
    }
    if guideline_context is not None:
        inventory['guidelineContext'] = guideline_context
    external_path = FIGMA / 'external-reference-resolution.json'
    if external_path.exists():
        inventory['externalReferences'] = read_json(external_path)
        validation['consumerReferenceLookups'] = inventory['externalReferences']['summary']
        validation['referencedVariableAliasGraphClosed'] = inventory['externalReferences']['aliasGraphClosed']
        inventory['scope']['notes'].append('Referenced variable/style definitions outside the six exported collections are retained separately, including remote metadata, unlisted definitions, a null style lookup and all reachable alias targets. Matching keys do not silently merge reference snapshots into canonical ZIP tokens.')
    destination = OUTPUTS / 'design-system-inventory.json'
    destination.write_text(json.dumps(inventory, ensure_ascii=False, separators=(',', ':')))
    loaded = read_json(destination)
    assert loaded['summary'] == inventory['summary']
    print(json.dumps({'output': str(destination), 'bytes': destination.stat().st_size,
                      'summary': inventory['summary'],
                      'previewCount': len(visuals), 'previewPageCount': validation['previewPageCount'],
                      'previewManifests': manifests,
                      'sourceInstancePropertyGetterErrors': len(source_errors),
                      'allChecksPassed': validation['allChecksPassed'],
                      'zipSha256': zip_digest}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
