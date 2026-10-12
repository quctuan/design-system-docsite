#!/usr/bin/env python3
"""Build an offline Step 2 review report from the validated inventory JSON."""

import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "outputs" / "design-system-inventory.json"
TEMPLATE = ROOT / "work" / "review-report.html"
OUTPUT = ROOT / "outputs" / "design-system-audit.html"
SOURCE_ZIP = Path("/Users/tuanvq/Downloads/Design System.zip")
ZIP_OUTPUT = ROOT / "outputs" / "design-system-tokens-source.zip"
PLACEHOLDER = "<!--__EMBEDDED_INVENTORY__-->"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


inventory = json.loads(INPUT.read_text(encoding="utf-8"))
summary = inventory.get("summary", {})
styles = inventory.get("styles", {})
validation = inventory.get("validation", {})
visuals = inventory.get("visuals", [])

require(validation.get("allChecksPassed") is True, "Inventory validation did not pass")
require(len(inventory.get("pages", [])) == summary.get("pageCount") == 60, "Expected 60 source pages")
require(len(inventory.get("tokens", [])) == summary.get("tokenValueCount") == 506, "Expected 506 mode values")
require(len(inventory.get("figmaVariables", [])) == 420, "Expected 420 local Figma variables")
require(sum(len(v) for v in styles.values()) == summary.get("styleCount") == 87, "Expected 87 local styles")
require(len(visuals) == 112, "Expected 112 source preview records")
require(len(inventory.get("guidelineContext", {}).get("rules", [])) == 12, "Expected 12 Liquid Glass Do/Don't annotations")

for preview in visuals:
    rel = preview.get("relativePath")
    require(bool(rel), f"Preview has no relativePath: {preview.get('nodeId')}")
    path = (OUTPUT.parent / rel).resolve()
    require(path.is_relative_to(OUTPUT.parent.resolve()), f"Preview escapes outputs: {rel}")
    require(path.is_file(), f"Preview missing: {rel}")

if not ZIP_OUTPUT.is_file():
    require(SOURCE_ZIP.is_file(), "Source token ZIP is missing")
    shutil.copy2(SOURCE_ZIP, ZIP_OUTPUT)

template = TEMPLATE.read_text(encoding="utf-8")
require(template.count(PLACEHOLDER) == 1, "HTML template must contain one inventory placeholder")

# Never allow source strings to terminate the inline script or become HTML.
payload = json.dumps(inventory, ensure_ascii=False, separators=(",", ":"))
payload = (
    payload.replace("&", "\\u0026")
    .replace("<", "\\u003c")
    .replace(">", "\\u003e")
    .replace("\u2028", "\\u2028")
    .replace("\u2029", "\\u2029")
)
embedded = '<script id="inventory-data" type="application/json">' + payload + "</script>"
OUTPUT.write_text(template.replace(PLACEHOLDER, embedded), encoding="utf-8")

print(
    json.dumps(
        {
            "output": str(OUTPUT),
            "bytes": OUTPUT.stat().st_size,
            "pages": len(inventory["pages"]),
            "tokens": len(inventory["tokens"]),
            "localStyles": sum(len(v) for v in styles.values()),
            "localVariables": len(inventory["figmaVariables"]),
            "previews": len(visuals),
            "guidelineAnnotations": len(inventory["guidelineContext"]["rules"]),
        },
        ensure_ascii=False,
    )
)
