"""Rebuild the offline HTML from the editable source without dependencies."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
source = root / 'source'
html = (source / 'index.html').read_text(encoding='utf-8')
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
              lambda m: '<style>' + (source / m[1]).read_text(encoding='utf-8') + '</style>', html)
html = re.sub(r'<script src="([^"]+)"></script>',
              lambda m: '<script>\n' + (source / m[1]).read_text(encoding='utf-8') + '\n</script>', html)
(root / 'CSVtoGraphViewer.html').write_text(html, encoding='utf-8')
