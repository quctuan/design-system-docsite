#!/usr/bin/env python3
"""Summarize decoded semantic Figma snapshots without modifying source data."""

import glob
import itertools
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


BASE = Path(__file__).resolve().parent
SNAPSHOT_RE = re.compile(r"semantic-[0-9]+-[0-9]+\.json$")
paths = sorted(Path(p) for p in glob.glob(str(BASE / "semantic-*.json")) if SNAPSHOT_RE.search(p))

facts = {
    "inventory": {
        "semanticSnapshotCount": len(paths),
        "pageCount": 0,
        "componentSetCount": 0,
        "componentCount": 0,
        "componentSetsWithChildren": 0,
    },
    "variantSchema": {
        "duplicateVariantTuples": [],
        "setsWithoutVariantSchema": [],
        "setsWithoutChildren": [],
        "childrenWithMissingOrUnexpectedVariantProperties": [],
        "schemaOptionMismatches": [],
        "setsWithUnrepresentedCartesianCombinations": [],
    },
    "sourceReadErrors": [],
    "statusMarkers": {
        "completedBadgePages": [],
        "draftBadgePages": [],
        "draftNamedPages": [],
        "pagesWithoutCompletedOrDraftBadge": [],
    },
}

for path in paths:
    data = json.loads(path.read_text())
    page = data["page"]
    page_ref = {"pageId": page["id"], "pageName": page["name"]}
    facts["inventory"]["pageCount"] += 1

    components = data.get("components", [])
    sets = [item for item in components if item["type"] == "COMPONENT_SET"]
    children = defaultdict(list)
    for item in components:
        if item["type"] == "COMPONENT":
            children[item.get("parentId")].append(item)
    facts["inventory"]["componentSetCount"] += len(sets)
    facts["inventory"]["componentCount"] += sum(len(items) for items in children.values())

    for component_set in sets:
        set_ref = {
            **page_ref,
            "setId": component_set["id"],
            "setName": component_set["name"],
        }
        variants = children[component_set["id"]]
        if variants:
            facts["inventory"]["componentSetsWithChildren"] += 1
        else:
            facts["variantSchema"]["setsWithoutChildren"].append(set_ref)

        groups = component_set.get("variantGroups") or {}
        properties = component_set.get("properties") or {}
        variant_properties = {
            key: value for key, value in properties.items() if value.get("type") == "VARIANT"
        }
        if not groups or not variant_properties:
            facts["variantSchema"]["setsWithoutVariantSchema"].append(set_ref)
        for name in set(groups) | set(variant_properties):
            group_values = set((groups.get(name) or {}).get("values") or [])
            prop_values = set((variant_properties.get(name) or {}).get("variantOptions") or [])
            default = (variant_properties.get(name) or {}).get("defaultValue")
            if group_values != prop_values or default not in prop_values:
                facts["variantSchema"]["schemaOptionMismatches"].append(
                    {**set_ref, "property": name, "groupValues": sorted(group_values),
                     "propertyOptions": sorted(prop_values), "defaultValue": default}
                )

        by_tuple = defaultdict(list)
        actual_tuples = set()
        for variant in variants:
            tuple_data = variant.get("variantProperties") or {}
            if set(tuple_data) != set(groups):
                facts["variantSchema"]["childrenWithMissingOrUnexpectedVariantProperties"].append(
                    {**set_ref, "componentId": variant["id"], "componentName": variant["name"],
                     "variantProperties": tuple_data}
                )
            key = tuple(sorted(tuple_data.items()))
            actual_tuples.add(key)
            by_tuple[key].append(variant)
        for key, same_tuple_variants in by_tuple.items():
            if len(same_tuple_variants) > 1:
                facts["variantSchema"]["duplicateVariantTuples"].append(
                    {**set_ref, "tuple": dict(key),
                     "components": [{"id": item["id"], "name": item["name"]} for item in same_tuple_variants]}
                )

        names = sorted(groups)
        products = list(itertools.product(*[(groups[name].get("values") or []) for name in names]))
        expected_tuples = {
            tuple(sorted(zip(names, values))) for values in products
        }
        missing_tuples = sorted(expected_tuples - actual_tuples)
        if missing_tuples:
            facts["variantSchema"]["setsWithUnrepresentedCartesianCombinations"].append(
                {**set_ref, "expectedCombinationCount": len(expected_tuples),
                 "definedComponentCount": len(variants), "unrepresentedCombinationCount": len(missing_tuples),
                 "sampleUnrepresentedTuples": [dict(item) for item in missing_tuples[:6]]}
            )

    error_groups = defaultdict(list)
    for error in data.get("errors", []):
        key = (error.get("field"), error.get("name"), error.get("message"))
        error_groups[key].append(error.get("id"))
    for (field, name, message), node_ids in sorted(error_groups.items()):
        facts["sourceReadErrors"].append(
            {**page_ref, "field": field, "nodeName": name, "message": message,
             "affectedNodeCount": len(node_ids), "nodeIds": node_ids}
        )

    marker_groups = defaultdict(list)
    for text in data.get("texts", []):
        if not text.get("hiddenOnly") and text.get("value") in {"COMPLETED", "DRAFT"}:
            marker_groups[text["value"]].extend(text.get("nodes", []))
    for marker, target in (
        ("COMPLETED", "completedBadgePages"),
        ("DRAFT", "draftBadgePages"),
    ):
        if marker_groups[marker]:
            facts["statusMarkers"][target].append(
                {**page_ref, "marker": marker, "nodeCount": len(marker_groups[marker]),
                 "nodeIds": marker_groups[marker]}
            )
    if "draft" in page["name"].lower():
        facts["statusMarkers"]["draftNamedPages"].append(
            {**page_ref, "componentSetCount": len(sets),
             "componentCount": sum(len(items) for items in children.values())}
        )
    if not any(marker_groups.values()):
        facts["statusMarkers"]["pagesWithoutCompletedOrDraftBadge"].append(page_ref)

review = {
    "schemaVersion": 1,
    "scope": {
        "sourcePattern": "work/figma-audit/semantic-PAGE-ID.json",
        "tokenReviewReference": "work/token-audit/review-findings.json",
        "method": "Exact tuple and schema checks on decoded COMPONENT_SET and COMPONENT records; exact visible text marker matching.",
    },
    "sourceFacts": facts,
    "editorialInterpretation": {
        "approvalConclusion": "No approval conclusion is inferred from source badges, page names, or the absence of a badge.",
        "reviewRisks": [
            "The page titled 🚧 Draft contains component sets. Keep its draft provenance distinct from pages with visible COMPLETED markers.",
            "Unrepresented Cartesian combinations in eight sets are not proof of missing designs. Document only tuples represented by source components unless a designer confirms other combinations.",
            "Property reads failed for nested instances on three pages because their referenced component sets have existing errors. Preserve error evidence and avoid claiming a complete property schema for those instances.",
            "The separate token review documents source naming, unit, style, and platform coverage issues; keep them alongside this component review without merging inferred corrections into source facts.",
        ],
    },
}

out = BASE / "component-review-findings.json"
out.write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({
    "path": str(out),
    "pages": len(paths),
    "sets": facts["inventory"]["componentSetCount"],
    "components": facts["inventory"]["componentCount"],
    "duplicateTuples": len(facts["variantSchema"]["duplicateVariantTuples"]),
    "missingSchemas": len(facts["variantSchema"]["setsWithoutVariantSchema"]),
    "unrepresentedSets": len(facts["variantSchema"]["setsWithUnrepresentedCartesianCombinations"]),
    "sourceReadErrors": sum(item["affectedNodeCount"] for item in facts["sourceReadErrors"]),
    "completedBadgePages": len(facts["statusMarkers"]["completedBadgePages"]),
    "draftBadgePages": len(facts["statusMarkers"]["draftBadgePages"]),
}, ensure_ascii=False))
