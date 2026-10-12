"""Compare complete live Figma variables/styles with supplied token ZIP."""
from pathlib import Path
from collections import Counter, defaultdict
import json
import math
import re

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "work/token-audit"
live = json.loads((ROOT / "work/figma-audit/styles-variables.json").read_text())
discovery = json.loads((ROOT / "work/figma-audit/discovery.json").read_text())
export = json.loads((OUT / "tokens.normalized.json").read_text())["tokens"]
collections = {c["id"]: c for c in discovery["collections"]}
variables = {v["id"]: v for v in live["variables"]}
live_by_name = {(collections[v["variableCollectionId"]]["name"], v["name"]): v for v in variables.values()}
zip_by_mode = {(t["collection"], t["name"], t["mode"]): t for t in export}

def dump(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")

def same(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=1e-7, abs_tol=1e-7)
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b))
    return a == b

def value_zip_to_live(t):
    if t["type"] == "color":
        c = t["value"]
        return dict(zip(("r", "g", "b"), c["components"])) | {"a": c["alpha"]}
    return t["value"]

def mode_name(v, mode_id):
    return next(m["name"] for m in collections[v["variableCollectionId"]]["modes"] if m["modeId"] == mode_id)

def resolve(v, mode_id, stack=()):
    key = (v["id"], mode_id)
    if key in stack:
        return {"error": "alias_cycle", "chain": list(stack) + [key]}
    raw = v["valuesByMode"][mode_id]
    if isinstance(raw, dict) and raw.get("type") == "VARIABLE_ALIAS":
        target = variables.get(raw["id"])
        if not target:
            return {"error": "missing_alias_id", "id": raw["id"]}
        c = collections[target["variableCollectionId"]]
        compatible = next((m["modeId"] for m in c["modes"] if m["name"] == mode_name(v, mode_id)), None)
        target_mode = compatible or c["defaultModeId"]
        return resolve(target, target_mode, stack + (key,))
    return raw

comparison, missing_export, missing_live = [], [], []
for (collection, name), var in live_by_name.items():
    for mid in var["valuesByMode"]:
        mode = mode_name(var, mid)
        identity = (collection, name, mode)
        token = zip_by_mode.get(identity)
        if not token:
            missing_export.append(list(identity))
            continue
        resolved = resolve(var, mid)
        raw = var["valuesByMode"][mid]
        target = variables.get(raw.get("id")) if isinstance(raw, dict) and raw.get("type") == "VARIABLE_ALIAS" else None
        alias = token["alias"]
        alias_comparison = None
        if target or alias:
            live_target_collection = collections[target["variableCollectionId"]]["name"] if target else None
            hash_match = re.fullmatch(r"VariableID:([^/]+)/-1:-1", alias["targetVariableId"]) if alias else None
            alias_comparison = {"zip": alias, "liveTarget": {"id": target["id"], "key": target["key"],
                                "name": target["name"], "collection": live_target_collection} if target else None,
                                "bothAreAlias": bool(target and alias),
                                "targetNameMatches": bool(target and alias and target["name"] == alias["targetVariableName"]),
                                "targetCollectionMatches": bool(target and alias and live_target_collection == alias["targetVariableSetName"]),
                                "targetPublishedKeyMatches": bool(target and hash_match and target["key"] == hash_match[1])}
        row = {"collection": collection, "name": name, "mode": mode,
               "zipVariableId": token["figmaVariableId"], "liveVariableId": var["id"], "liveVariableKey": var["key"],
               "sameVariableId": token["figmaVariableId"] == var["id"],
               "typeMatches": token["type"] == {"COLOR": "color", "FLOAT": "number", "STRING": "string", "BOOLEAN": "boolean"}[var["resolvedType"]],
               "valueMatches": same(value_zip_to_live(token), resolved), "zipValue": token["value"], "liveValue": resolved,
               "scopesMatch": sorted(token["scopes"]) == sorted(var["scopes"]),
               "zipScopes": token["scopes"], "liveScopes": var["scopes"],
               "hiddenFromPublishingMatches": token["hiddenFromPublishing"] == var["hiddenFromPublishing"],
               "liveCollectionHiddenFromPublishing": collections[var["variableCollectionId"]]["hiddenFromPublishing"],
               "zipDescription": token["description"], "liveDescription": var["description"],
               "liveCodeSyntax": var["codeSyntax"], "zipCodeSyntax": token["rawToken"].get("$extensions", {}).get("com.figma.codeSyntax"),
               "aliasComparison": alias_comparison}
        comparison.append(row)
for identity in zip_by_mode:
    col, name, mode = identity
    var = live_by_name.get((col, name))
    if not var or mode not in [mode_name(var, mid) for mid in var["valuesByMode"]]:
        missing_live.append(list(identity))

aliases = [r["aliasComparison"] for r in comparison if r["aliasComparison"]]
zip_ids_different = sorted(set((r["collection"], r["name"]) for r in comparison if not r["sameVariableId"]))
comparison_summary = {"liveVariableCount": len(variables), "zipUniqueVariableCount": len(set((t["collection"], t["name"]) for t in export)),
                      "liveModeValueCount": sum(len(v["valuesByMode"]) for v in variables.values()),
                      "comparedValueCount": len(comparison), "missingFromZIP": missing_export, "missingFromLive": missing_live,
                      "valueMismatches": sum(not r["valueMatches"] for r in comparison),
                      "typeMismatches": sum(not r["typeMatches"] for r in comparison),
                      "scopeMismatches": sum(not r["scopesMatch"] for r in comparison),
                      "scopeMismatchIdentityCount": len(set((r["collection"], r["name"]) for r in comparison if not r["scopesMatch"])),
                      "scopeMismatchPatterns": [{"zip": list(z), "live": list(l), "valueCount": n} for (z, l), n in Counter((tuple(r["zipScopes"]), tuple(r["liveScopes"])) for r in comparison if not r["scopesMatch"]).items()],
                      "hiddenFromPublishingMismatches": sum(not r["hiddenFromPublishingMatches"] for r in comparison),
                      "differentVariableIdIdentityCount": len(zip_ids_different),
                      "differentVariableIdIdentities": [list(x) for x in zip_ids_different],
                      "aliasValues": len(aliases),
                      "aliasTargetNameMatches": sum(a["targetNameMatches"] for a in aliases),
                      "aliasTargetCollectionMatches": sum(a["targetCollectionMatches"] for a in aliases),
                      "aliasTargetPublishedKeyMatches": sum(a["targetPublishedKeyMatches"] for a in aliases),
                      "liveVariableDescriptionsNonempty": sum(bool(v["description"]) for v in variables.values()),
                      "liveCodeSyntaxNonempty": [{"collection": collections[v["variableCollectionId"]]["name"],
                                                  "name": v["name"], "id": v["id"], "codeSyntax": v["codeSyntax"]}
                                                 for v in variables.values() if v["codeSyntax"]],
                      "tolerance": {"relative": 1e-7, "absolute": 1e-7},
                      "notes": ["Compare source numbers unchanged. Ignore source hex helper for float RGB comparison.",
                                "Different local IDs are reported separately from semantic identity; name/type/value/alias target key are compared explicitly.",
                                "Collections and variable-level hiddenFromPublishing are distinct; preserve both."]}
dump("figma-comparison.json", {"summary": comparison_summary, "comparisons": comparison})

def bindings(obj, path=()):
    found = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "boundVariables":
                for field, ref in v.items():
                    refs = ref if isinstance(ref, list) else [ref]
                    for index, item in enumerate(refs):
                        if isinstance(item, dict) and item.get("type") == "VARIABLE_ALIAS":
                            target = variables.get(item["id"])
                            found.append({"path": list(path), "field": field, "index": index,
                                          "reference": item, "target": {"collection": collections[target["variableCollectionId"]]["name"],
                                                                     "name": target["name"], "id": target["id"], "key": target["key"]} if target else None,
                                          "value": resolve(target, collections[target["variableCollectionId"]]["defaultModeId"]) if target else None})
            elif isinstance(v, (dict, list)):
                found += bindings(v, path + (k,))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            found += bindings(v, path + (i,))
    return found

def at_path(obj, path):
    for key in path:
        obj = obj[key]
    return obj

all_style_refs, style_details, style_binding_mismatches = [], {}, []
for group in ["textStyles", "paintStyles", "effectStyles", "gridStyles"]:
    details = []
    for style in live[group]:
        refs = bindings(style)
        for ref in refs:
            expected = ref["value"]
            raw = at_path(style, ref["path"])
            if group == "textStyles":
                field = ref["field"]
                actual = (style["fontName"]["family"] if field == "fontFamily" else
                          style["fontName"]["style"] if field == "fontStyle" else
                          style["fontSize"] if field == "fontSize" else
                          style["lineHeight"].get("value") if field == "lineHeight" else raw.get(field))
            else:
                actual = raw.get(ref["field"])
            ref["actualValue"] = actual
            ref["valueMatches"] = same(expected, actual) if ref["target"] else None
            all_style_refs.append({"styleType": group, "styleId": style["id"], "styleName": style["name"]} | ref)
            if ref["valueMatches"] is False:
                style_binding_mismatches.append(all_style_refs[-1])
        details.append({"rawStyle": style, "bindingCount": len(refs), "bindings": refs})
    style_details[group] = details

used = Counter(ref["reference"]["id"] for ref in all_style_refs)
unreferenced_typography = [{"name": v["name"], "id": v["id"],
                            "value": resolve(v, collections[v["variableCollectionId"]]["defaultModeId"])}
                           for v in variables.values()
                           if collections[v["variableCollectionId"]]["name"] == "4. Typography" and not used[v["id"]]]

style_summary = {"counts": {k: len(v) for k, v in style_details.items()},
                 "descriptionCount": {k: sum(bool(d["rawStyle"]["description"]) for d in v) for k, v in style_details.items()},
                 "bindingCountByStyleType": {k: sum(d["bindingCount"] for d in v) for k, v in style_details.items()},
                 "stylesWithBindings": {k: sum(d["bindingCount"] > 0 for d in v) for k, v in style_details.items()},
                 "stylesWithoutBindings": {k: sum(d["bindingCount"] == 0 for d in v) for k, v in style_details.items()},
                 "missingBindingTargetCount": sum(ref["target"] is None for ref in all_style_refs),
                 "bindingValueMismatchCount": len(style_binding_mismatches),
                 "bindingValueMismatches": style_binding_mismatches,
                 "tokenReferenceCounts": [{"id": vid, "name": variables[vid]["name"],
                                            "collection": collections[variables[vid]["variableCollectionId"]]["name"],
                                            "count": count} for vid, count in used.most_common()],
                 "unreferencedTypographyTokensByStyles": unreferenced_typography,
                 "lineHeightBindingsOutsideTypography": [{"style": d["rawStyle"]["name"], "binding": ref} for d in style_details["textStyles"] for ref in d["bindings"] if ref["field"] == "lineHeight" and ref["target"]["collection"] != "4. Typography"],
                 "textFamilies": dict(Counter(s["fontName"]["family"] for s in live["textStyles"])),
                 "textFontStyles": dict(Counter(s["fontName"]["style"] for s in live["textStyles"])),
                 "lineHeightUnits": dict(Counter(s["lineHeight"]["unit"] for s in live["textStyles"])),
                 "letterSpacingUnits": dict(Counter(s["letterSpacing"]["unit"] for s in live["textStyles"])),
                 "paintTypes": dict(Counter(p["type"] for s in live["paintStyles"] for p in s["paints"])),
                 "effectTypes": dict(Counter(e["type"] for s in live["effectStyles"] for e in s["effects"])),
                 "gridNameCountConflict": [{"id": s["id"], "name": s["name"], "sourceLayoutGrids": s["layoutGrids"],
                                           "issue": "Name says 4 Col, actual count is 12. Keep both source fields and flag for review; do not silently rename."}
                                          for s in live["gridStyles"] if "4 Col" in s["name"] and any(g.get("count") != 4 for g in s["layoutGrids"])],
                 "units": {"fontSize": "Figma text style size", "lineHeight": "explicit PIXELS on all 40 source text styles",
                           "letterSpacing": "explicit PERCENT on all 40 source text styles",
                           "variableNumber": "FLOAT values have no unit field; font sizes/line heights gain context from text style bindings",
                           "radiusSpacing": "FLOAT values and scopes only; do not claim an explicit ZIP unit"},
                 "gaps": ["Android Inter Tight family token exists; all 40 local text styles use SF Pro Display. No Android composite text styles in local styles collection.",
                          "Only 3/40 text styles have descriptions; variables, paint, effect and grid descriptions are empty.",
                          "Only 2 variables provide codeSyntax, both iOS Gray/100; ZIP export omitted these fields. Preserve live code syntax and flag duplicate syntax across Light/Dark.",
                          "Paint/effect/grid styles are separate live source content not included in token ZIP.",
                          "Caption/Caption sm/{Regular,Medium,Bold} use lineHeight 12 PIXELS bound directly to _Global Dimension/12x. There is no corresponding font/Line-height token; preserve the explicit primitive binding.",
                          "Some styles use direct values without token bindings. Preserve raw paints/effects/grid values as source style specifications; do not invent missing token aliases.",
                          "Node-level usage is not represented by styles-variables.json. This report audits local style token bindings, not all consumer nodes."],
                 "styleDetails": style_details}
dump("styles-summary.json", style_summary)
print(json.dumps({"variableComparison": comparison_summary,
                  "styleSummary": {k: v for k, v in style_summary.items() if k not in ("styleDetails", "tokenReferenceCounts")}}, ensure_ascii=False, indent=2))
