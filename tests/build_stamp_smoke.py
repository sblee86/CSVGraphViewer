"""Verify repeatable build stamps and automatic version bumps in an isolated copy."""
from pathlib import Path
import tempfile
import shutil
import subprocess
import json
import sys

root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as directory:
    target=Path(directory)
    shutil.copytree(root/'source',target/'source')
    (target/'scripts').mkdir()
    shutil.copy2(root/'scripts/build_standalone.py',target/'scripts/build_standalone.py')
    def build():
        subprocess.run([sys.executable,str(target/'scripts/build_standalone.py')],check=True)
        return json.loads((target/'build.json').read_text())
    first=build()
    html=(target/'CSVtoGraphViewer.html').read_bytes()
    assert build()==first and (target/'CSVtoGraphViewer.html').read_bytes()==html
    with (target/'source/panel-layout.js').open('a') as output:
        output.write('\n// Simulated software change.\n')
    changed=build()
    assert int(changed['version'].split('.')[-1])==int(first['version'].split('.')[-1])+1
    assert changed['source_hash']!=first['source_hash']
    assert changed['built_at'].endswith('+09:00')
    assert changed['version'] in (target/'CSVtoGraphViewer.html').read_text()
print('PASS unchanged builds retain stamp; software edits bump version/hash; Korean build timezone; offline stamp matches')
