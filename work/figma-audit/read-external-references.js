const kind = BATCH_KIND, ids = BATCH_IDS;
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') { const r = {}; for (const k of Object.keys(v).sort()) if (v[k] !== undefined) r[k] = canonical(v[k]); return r; }
  return v;
}
function pick(o, fields, errors) {
  const record = {};
  for (const field of fields) {
    try { if (field in o) { const value = o[field]; if (typeof value !== 'symbol' && typeof value !== 'function') record[field] = canonical(value); } }
    catch (e) { errors.push({field, message: String(e)}); }
  }
  return record;
}
const records = await Promise.all(ids.map(async requestId => {
  try {
    const object = kind === 'variable' ? await figma.variables.getVariableByIdAsync(requestId) : await figma.getStyleByIdAsync(requestId);
    if (!object) return {requestId, status: 'null', record: null};
    const fieldErrors = [];
    let record;
    if (kind === 'variable') record = pick(object, ['id','key','name','description','remote','variableCollectionId','resolvedType','valuesByMode','scopes','codeSyntax','hiddenFromPublishing'], fieldErrors);
    else {
      record = pick(object, ['id','key','name','description','descriptionMarkdown','remote','type','boundVariables'], fieldErrors);
      if (object.type === 'TEXT') Object.assign(record, pick(object, ['fontName','fontSize','lineHeight','letterSpacing','leadingTrim','paragraphSpacing','paragraphIndent','textCase','textDecoration','textWrapStyle','listSpacing','hangingPunctuation','hangingList'], fieldErrors));
      else if (object.type === 'PAINT') Object.assign(record, pick(object, ['paints'], fieldErrors));
      else if (object.type === 'EFFECT') Object.assign(record, pick(object, ['effects'], fieldErrors));
      else if (object.type === 'GRID') Object.assign(record, pick(object, ['layoutGrids'], fieldErrors));
    }
    return {requestId, status: fieldErrors.length ? 'resolved_with_field_errors' : 'resolved', record, fieldErrors};
  } catch (e) { return {requestId, status: 'error', record: null, error: String(e)}; }
}));
const result = canonical({schema: 'figma-external-reference-resolution-v1', kind, batchIndex: BATCH_INDEX, requestedIds: ids, records});
const raw = JSON.stringify(result), src = unescape(encodeURIComponent(raw));
let a = 1, b = 0; for (let i = 0; i < src.length; i++) { a = (a + src.charCodeAt(i)) % 65521; b = (b + a) % 65521; }
PAKO_CODE
const packed = module.exports.deflate(src.split('').map(c => c.charCodeAt(0)), {level: 6});
let binary = ''; for (let i = 0; i < packed.length; i += 4096) binary += String.fromCharCode(...packed.slice(i, i + 4096));
const encoded = btoa(binary), size = 18500, index = CHUNK_INDEX;
return {encoding: 'zlib-utf8-base64', kind, batchIndex: BATCH_INDEX, requestedCount: ids.length, index, chunks: Math.max(1, Math.ceil(encoded.length / size)), byteLength: src.length, checksum: ((b << 16) | a) >>> 0, data: encoded.slice(index * size, (index + 1) * size)};
