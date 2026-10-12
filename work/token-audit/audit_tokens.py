"""Audit the user-supplied Figma token exports without altering source data."""
from pathlib import Path
from collections import Counter, defaultdict
import csv
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE = ROOT / "work/tokens-source"
OUTPUT = ROOT / "work/token-audit"
EXPECTED = {"_Global Colors": 250, "_Global Dimension": 29,
            "1. Color modes": 86, "2. Radius": 12,
            "3. Spacing": 17, "4. Typography": 26}
OUTPUT.mkdir(parents=True, exist_ok=True)

def dump(name, value):
    (OUTPUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")

def same_value(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=1e-7, abs_tol=1e-7)
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(same_value(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(same_value(x, y) for x, y in zip(a, b))
    return a == b

tokens, files, duplicate_json_keys = [], [], []
for path in sorted(SOURCE.rglob("*.tokens.json")):
    local_duplicate_keys = []
    def pairs_hook(pairs):
        obj = {}
        for key, value in pairs:
            if key in obj:
                local_duplicate_keys.append(key)
            obj[key] = value
        return obj
    raw = path.read_bytes()
    data = json.loads(raw, object_pairs_hook=pairs_hook)
    collection = path.parent.name
    mode = data.get("$extensions", {}).get("com.figma.modeName")
    assert mode, f"Missing explicit mode: {path}"
    source_path = str(path.relative_to(SOURCE))
    file_record = {"sourceFile": source_path, "sha256": hashlib.sha256(raw).hexdigest(),
                   "bytes": len(raw), "collection": collection, "mode": mode,
                   "sourceMetadata": data.get("$extensions", {}), "tokenCount": 0}
    files.append(file_record)
    duplicate_json_keys += [{"sourceFile": source_path, "key": k} for k in local_duplicate_keys]
    def walk(obj, parts=(), group_metadata=()):
        if not isinstance(obj, dict):
            return
        if "$value" in obj:
            ext = obj.get("$extensions", {})
            name = "/".join(parts)
            token = {"collection": collection, "mode": mode, "name": name,
                     "path": list(parts), "type": obj.get("$type"), "value": obj["$value"],
                     "sourceFile": source_path, "figmaVariableId": ext.get("com.figma.variableId"),
                     "scopes": ext.get("com.figma.scopes", []),
                     "hiddenFromPublishing": ext.get("com.figma.hiddenFromPublishing", False),
                     "description": obj.get("$description"), "alias": ext.get("com.figma.aliasData"),
                     "rawToken": obj, "groupMetadata": list(group_metadata)}
            tokens.append(token)
            file_record["tokenCount"] += 1
            return
        metadata = {k: v for k, v in obj.items() if k.startswith("$")}
        next_meta = group_metadata + (({"path": list(parts), "metadata": metadata},) if metadata else ())
        for key, child in obj.items():
            if not key.startswith("$"):
                walk(child, parts + (key,), next_meta)
    walk(data)

by_id, by_name, by_identity = defaultdict(list), defaultdict(list), defaultdict(list)
for token in tokens:
    by_id[token["figmaVariableId"]].append(token)
    by_name[(token["collection"], token["name"])].append(token)
    by_identity[(token["collection"], token["mode"], token["name"])].append(token)

aliases, unresolved_by_name, mismatches = [], [], []
for token in tokens:
    alias = token["alias"]
    if not alias:
        continue
    id_candidates = by_id.get(alias.get("targetVariableId"), [])
    name_candidates = by_name.get((alias.get("targetVariableSetName"), alias.get("targetVariableName")), [])
    # An explicit target collection/name is source data. Preserve ID lookup failure
    # separately; never rewrite the alias ID to the local export's ID.
    candidates = id_candidates or name_candidates
    result = {"source": {k: token[k] for k in ("collection", "mode", "name", "figmaVariableId", "sourceFile")},
              "sourceAlias": alias, "idResolved": bool(id_candidates),
              "nameResolved": bool(name_candidates),
              "resolutionMethod": "exact_id" if id_candidates else "explicit_collection_and_name" if name_candidates else "unresolved",
              "targets": [{k: c[k] for k in ("collection", "mode", "name", "figmaVariableId", "value", "sourceFile")} for c in candidates],
              "valueMatchesTargets": all(same_value(token["value"], c["value"]) for c in candidates) if candidates else None}
    aliases.append(result)
    token["aliasAudit"] = {"resolutionMethod": result["resolutionMethod"],
                            "idResolved": result["idResolved"], "nameResolved": result["nameResolved"],
                            "valueMatchesTargets": result["valueMatchesTargets"]}
    if not candidates:
        unresolved_by_name.append(result)
    elif not result["valueMatchesTargets"]:
        mismatches.append(result)

collections = []
for collection in EXPECTED:
    rows = [t for t in tokens if t["collection"] == collection]
    modes = sorted(set(t["mode"] for t in rows))
    names = sorted(set(t["name"] for t in rows))
    collections.append({"name": collection, "expectedTokenCountFromScreenshot": EXPECTED[collection],
                        "uniqueTokenCount": len(names), "matchesScreenshot": len(names) == EXPECTED[collection],
                        "modeCount": len(modes), "modes": modes, "valueCount": len(rows),
                        "typesByValueCount": dict(Counter(t["type"] for t in rows)),
                        "aliasValueCount": sum(bool(t["alias"]) for t in rows),
                        "hiddenFromPublishingValueCount": sum(t["hiddenFromPublishing"] for t in rows),
                        "groups": dict(Counter(t["path"][0] for t in rows)),
                        "modeTokenCounts": {m: sum(t["mode"] == m for t in rows) for m in modes},
                        "modeNameDifferences": {m: sorted(set(names) - set(t["name"] for t in rows if t["mode"] == m)) for m in modes}})

duplicate_id_per_mode = [{"figmaVariableId": var_id, "collection": col, "mode": mode,
                          "tokens": [t["name"] for t in matches]}
                         for var_id, rows in by_id.items()
                         for (col, mode), matches in [(key, [t for t in rows if (t["collection"], t["mode"]) == key])
                                                      for key in sorted(set((t["collection"], t["mode"]) for t in rows))]
                         if len(matches) > 1]

same_value_groups = []
value_groups = defaultdict(list)
for token in tokens:
    key = (token["collection"], token["mode"], token["type"], json.dumps(token["value"], sort_keys=True))
    value_groups[key].append(token["name"])
for (collection, mode, typ, val), names in value_groups.items():
    if len(names) > 1:
        same_value_groups.append({"collection": collection, "mode": mode, "type": typ,
                                  "value": json.loads(val), "names": names})

mode_comparison = []
for name in sorted(set(t["name"] for t in tokens if t["collection"] == "1. Color modes")):
    rows = by_name[("1. Color modes", name)]
    vals = {t["mode"]: t["value"] for t in rows}
    mode_comparison.append({"name": name, "values": vals,
                           "aliases": {t["mode"]: t["alias"] for t in rows},
                           "sameValueAcrossModes": same_value(vals["VNPT"], vals["VIBE CLUB"])})

summary = {"sourceArchive": "/Users/tuanvq/Downloads/Design System.zip",
           "sourceArchiveSha256": hashlib.sha256(Path("/Users/tuanvq/Downloads/Design System.zip").read_bytes()).hexdigest(),
           "fileCount": len(files), "collectionCount": len(collections),
           "uniqueTokenCount": len(by_name), "tokenValueCount": len(tokens),
           "typeCountsByValue": dict(Counter(t["type"] for t in tokens)),
           "aliasValueCount": len(aliases), "strictIdResolvedAliasValueCount": sum(a["idResolved"] for a in aliases),
           "explicitNameResolvedAliasValueCount": sum(a["nameResolved"] for a in aliases),
           "unresolvedAliasValueCount": len(unresolved_by_name),
           "aliasValueMismatchCount": len(mismatches),
           "duplicateJsonKeys": duplicate_json_keys,
           "duplicateTokenIdentities": [{"identity": list(key), "count": len(rows)} for key, rows in by_identity.items() if len(rows) > 1],
           "duplicateVariableIdsWithinMode": duplicate_id_per_mode,
           "equalValueGroupCount": len(same_value_groups),
           "semanticValuesChangedAcrossModes": sum(not c["sameValueAcrossModes"] for c in mode_comparison),
           "semanticValuesUnchangedAcrossModes": sum(c["sameValueAcrossModes"] for c in mode_comparison),
           "collections": collections, "files": files,
           "notes": [
               "Collection names are preserved from enclosing ZIP filenames; mode names are explicit source metadata.",
               "Alias target IDs use hash-based /-1:-1 identities while primitive exports contain local IDs. The exact-ID lookup audit remains unresolved and is not rewritten.",
               "Explicit collection/name lookup is recorded independently from exact-ID lookup. Missing names are never guessed.",
               "Numeric token values have source type number and no explicit unit. Do not infer px/rem or numeric font weights from these exports.",
               "Global colors hiddenFromPublishing is source metadata and does not mean absent from the supplied export.",
               "Equal values are reported for inspection; they are not duplicate token identities and must not be collapsed.",
               "Float comparison tolerance is 1e-7; source values are stored unchanged."]}

dump("tokens.normalized.json", {"schemaVersion": 1, "tokens": tokens})
dump("summary.json", summary)
dump("alias-audit.json", {"aliases": aliases, "unresolved": unresolved_by_name, "valueMismatches": mismatches})
dump("mode-comparison.json", mode_comparison)
dump("same-value-groups.json", same_value_groups)
dump("collections.json", collections)
with (OUTPUT / "tokens.csv").open("w", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=["collection", "mode", "name", "type", "value", "figmaVariableId", "scopes", "hiddenFromPublishing", "alias", "sourceFile"])
    writer.writeheader()
    for token in tokens:
        writer.writerow({k: json.dumps(token[k], ensure_ascii=False) if k in ("value", "scopes", "alias") else token[k] for k in writer.fieldnames})

print(json.dumps(summary, ensure_ascii=False, indent=2))
