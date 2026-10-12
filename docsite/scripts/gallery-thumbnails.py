"""Create web thumbnails from native exports; master PNGs stay untouched."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parent.parent
gallery = json.loads((root / 'source/asset-gallery.json').read_text())
count = 0
for page in gallery['pages']:
    for item in page['items']:
        image = Image.open(root / 'public' / item['path']).convert('RGBA')
        image.thumbnail((480, 480), Image.Resampling.LANCZOS)
        image.save(root / 'public' / item['thumbnail'], 'PNG', optimize=True)
        count += 1
print(f'{count} thumbnails created')
