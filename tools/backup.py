#!/usr/bin/env python3
"""Create and verify a portable local snapshot using only Python's standard library."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
excluded = {'.git', 'node_modules', 'backups', 'vercel-auth', '__pycache__', '.DS_Store', '.dist-build', '.dist-previous'}

def include(file):
    parts = file.relative_to(root).parts
    return file.is_file() and not file.is_symlink() and not any(part in excluded or part.startswith('.env') for part in parts)

def digest(file):
    result = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()

files = sorted(file for file in root.rglob('*') if include(file))
created = datetime.now(ZoneInfo('Asia/Ho_Chi_Minh'))
backup_dir = root / 'backups'
backup_dir.mkdir(exist_ok=True)
archive = backup_dir / f"vnpt-design-system-{created.strftime('%Y-%m-%d_%H-%M-%S')}.zip"
manifest = {'createdAt': created.isoformat(), 'restoreDirectory': root.name,
            'files': [{'path': file.relative_to(root).as_posix(), 'bytes': file.stat().st_size, 'sha256': digest(file)} for file in files]}
manifest_text = json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as bundle:
    for file in files:
        bundle.write(file, (Path(root.name) / file.relative_to(root)).as_posix())
    bundle.writestr(f'{root.name}/BACKUP-MANIFEST.json', manifest_text)
with zipfile.ZipFile(archive) as bundle:
    damaged = bundle.testzip()
    if damaged:
        raise RuntimeError(f'Archive verification failed: {damaged}')
    if len(bundle.infolist()) != len(files) + 1:
        raise RuntimeError('Archive file count mismatch')
checksum = digest(archive)
archive.with_suffix('.sha256').write_text(f'{checksum}  {archive.name}\n')
archive.with_suffix('.manifest.json').write_text(manifest_text)
print(json.dumps({'archive': str(archive), 'fileCount': len(files), 'sizeMiB': round(archive.stat().st_size / 1024**2, 1), 'sha256': checksum, 'integrityVerified': True}, ensure_ascii=False))
