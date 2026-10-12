"""Recognize the real format of native Figma files and fill export metadata."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parent.parent
work = root.parent / 'work'
files = list((work / 'asset-exports').glob('*.metadata.json')) + [work / 'gallery-export-logo-0.json.metadata.json']
for packet in files:
    records = json.loads(packet.read_text())
    for item in records:
        source = root / 'public' / item['path']
        if not source.exists():
            continue
        image = Image.open(source)
        format_name = 'jpg' if image.format == 'JPEG' else 'png'
        item.update(pixelWidth=image.width, pixelHeight=image.height, bytes=source.stat().st_size, format=format_name)
        if format_name == 'jpg' and source.suffix != '.jpg':
            target = source.with_suffix('.jpg')
            source.rename(target)
            item['path'] = str(target.relative_to(root / 'public'))
    packet.write_text(json.dumps(records))
print(f'{len(files)} metadata files normalized')
