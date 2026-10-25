"""Rebuild the offline HTML from the editable source without dependencies."""
from pathlib import Path
import re
import hashlib
import json
from datetime import datetime
from zoneinfo import ZoneInfo

root = Path(__file__).resolve().parents[1]
source = root / 'source'
# Bump the patch version only when application/build sources change.
inputs = sorted(p for p in source.iterdir() if p.suffix in {'.html', '.js', '.css'} and p.name != 'build-info.js')
digest = hashlib.sha256()
for path in inputs + [Path(__file__).resolve()]:
    digest.update(path.name.encode()); digest.update(b'\0'); digest.update(path.read_bytes())
source_hash = digest.hexdigest()
metadata_path = root / 'build.json'
metadata = json.loads(metadata_path.read_text(encoding='utf-8')) if metadata_path.exists() else {'version': '1.0.0'}
if metadata.get('source_hash') != source_hash:
    major, minor, patch = map(int, metadata['version'].split('.'))
    metadata = {'version': f'{major}.{minor}.{patch+1}', 'built_at': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(timespec='seconds'), 'source_hash': source_hash}
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(source / 'build-info.js').write_text('window.CSV_GRAPH_BUILD=' + json.dumps(metadata, ensure_ascii=False) + ';\n', encoding='utf-8')
html = (source / 'index.html').read_text(encoding='utf-8')
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
              lambda m: '<style>' + (source / m[1]).read_text(encoding='utf-8') + '</style>', html)
html = re.sub(r'<script src="([^"]+)"></script>',
              lambda m: '<script>\n' + (source / m[1]).read_text(encoding='utf-8') + '\n</script>', html)
(root / 'CSVtoGraphViewer.html').write_text(html, encoding='utf-8')
