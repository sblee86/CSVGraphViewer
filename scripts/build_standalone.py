"""Build the offline HTML and automatically stamp software versions."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import hashlib
import json
import re

root = Path(__file__).resolve().parents[1]
source = root / "source"

# Generated metadata is excluded so an unchanged build remains repeatable.
inputs = sorted(
    path for path in source.iterdir()
    if path.suffix in {".html", ".js", ".css"} and path.name != "build-info.js"
)
digest = hashlib.sha256()
for path in inputs + [Path(__file__).resolve()]:
    digest.update(path.name.encode())
    digest.update(b"\0")
    digest.update(path.read_bytes())
source_hash = digest.hexdigest()

metadata_path = root / "build.json"
if metadata_path.exists():
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
else:
    metadata = {"version": "1.0.0"}

if metadata.get("source_hash") != source_hash:
    major, minor, patch = map(int, metadata["version"].split("."))
    metadata = {
        "version": f"{major}.{minor}.{patch + 1}",
        "built_at": datetime.now(ZoneInfo("Asia/Seoul")).isoformat(timespec="seconds"),
        "source_hash": source_hash,
    }
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

(source / "build-info.js").write_text(
    "window.CSV_GRAPH_BUILD = "
    + json.dumps(metadata, ensure_ascii=False, indent=2)
    + ";\n",
    encoding="utf-8",
)

# Allow formatted multiline tags and self-closing HTML stylesheet links.
html = (source / "index.html").read_text(encoding="utf-8")
html = re.sub(
    r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>',
    lambda match: "<style>\n"
    + (source / match[1]).read_text(encoding="utf-8")
    + "\n</style>",
    html,
)
html = re.sub(
    r'<script\s+src="([^"]+)"\s*>\s*</script>',
    lambda match: "<script>\n"
    + (source / match[1]).read_text(encoding="utf-8")
    + "\n</script>",
    html,
)
if re.search(r'<script\s+src=|<link\s+rel="stylesheet"', html):
    raise ValueError("The offline HTML still contains external JS/CSS dependencies")
(root / "CSVtoGraphViewer.html").write_text(html, encoding="utf-8")
