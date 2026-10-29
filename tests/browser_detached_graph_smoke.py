"""Exercise graph popup navigation/export and opt-in CSV selection following."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root)))
Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for entry in ['source/index.html', 'CSVtoGraphViewer.html']:
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/{entry}')
        page.evaluate('''() => {
          workspaceDialog.close();
          csvSources = [parseSource(serializeCSV(['T','V','Z'], Array.from({length:220},(_,i)=>[String(i),String(i*2),String(i*3)])), 'track.csv')];
          rebuildSources(false); selected = new Set([1]); csvSources[0].x=0; update();
        }''')
        with context.expect_page() as opened:
            page.locator('#previewSeparateWindow').click()
        csv = opened.value
        csv.on('pageerror', lambda e: errors.append(str(e)))
        csv.wait_for_selector('#followGraph')
        assert csv.locator('#followGraph').is_checked()
        page.evaluate('showPreviewHit({source:csvSources[0],localRow:150,columns:[1]})')
        assert csv.locator('.selected-row').get_attribute('data-row') == '150'
        assert csv.locator('.picked-cell').inner_text() == '300'
        csv.locator('#followGraph').uncheck()
        csv.locator('#search').fill('657')
        csv.wait_for_function("document.querySelectorAll('#grid tbody tr').length===1")
        page.evaluate('showPreviewHit({source:csvSources[0],localRow:10,columns:[1]})')
        assert csv.locator('#search').input_value() == '657'
        assert csv.locator('#grid tbody tr').get_attribute('data-row') == '219'
        csv.locator('#followGraph').check()
        assert csv.locator('.selected-row').get_attribute('data-row') == '10'
        assert csv.locator('#search').input_value() == ''
        with context.expect_page() as opened:
            page.locator('#graphSeparateWindow').click()
        graph = opened.value
        graph.on('pageerror', lambda e: errors.append(str(e)))
        graph.wait_for_selector('#graph')
        assert page.evaluate('graphWindowSnapshot().series[0].points.length') == 220
        graph.locator('#auto').click()
        graph.evaluate('''() => {
          window.lastSnapshot=null;
          const load=window.loadGraphSnapshot;
          window.loadGraphSnapshot=(s)=>{window.lastSnapshot=s;load(s)};
        }''')
        graph.locator('#refresh').click()
        assert graph.evaluate('lastSnapshot.series[0].points[150].v') == [150,300]
        # Click a real point in the detached graph and follow it in the CSV popup.
        graph.locator('#auto').click()
        coords = graph.locator('#graph').evaluate('''c => {
          const r=c.getBoundingClientRect();
          return {x:85+(r.width-110)*150/219,y:r.height-45-(r.height-75)*150/219};
        }''')
        graph.locator('#graph').click(position=coords)
        assert csv.locator('.selected-row').get_attribute('data-row') == '150'
        before = graph.locator('#graph').evaluate('c=>c.toDataURL()')
        graph.locator('#in').click()
        assert graph.locator('#graph').evaluate('c=>c.toDataURL()') != before
        assert page.evaluate('view === null')
        graph.locator('#pan').click()
        graph.locator('#graph').hover(position={'x':250,'y':150})
        graph.mouse.down(); graph.mouse.move(400,300); graph.mouse.up()
        graph.locator('#auto').click()
        graph.locator('#split').check()
        with graph.expect_download() as download:
            graph.locator('#png').click()
        first_name = download.value.suggested_filename
        assert first_name.endswith('.png')
        with graph.expect_download() as download:
            graph.locator('#png').click()
        assert '(1).png' in download.value.suggested_filename
        assert Path(download.value.path()).read_bytes().startswith(b'\x89PNG')
        # 3D snapshots and rotation are also independent.
        page.evaluate("$('dimension').value='3d';$('x').value='0';$('yaxis3').value='1';$('zaxis').value='2';update()")
        graph.locator('#refresh').click()
        assert graph.locator('#split').is_disabled()
        assert graph.evaluate('lastSnapshot.series[0].points[150].v') == [150,300,450]
        graph.locator('#zoom').click()
        graph.locator('#graph').hover(position={'x':300,'y':200})
        before = graph.locator('#graph').evaluate('c=>c.toDataURL()')
        graph.mouse.down(); graph.mouse.move(400,300); graph.mouse.up()
        assert graph.locator('#graph').evaluate('c=>c.toDataURL()') != before
        # Target-specific conditions remain isolated in popup snapshots.
        preset = (root / 'datasets/CFCS_105_4targets.json').read_text(encoding='utf-8')
        dataset = (root / 'datasets/CFCS_105.csv').read_text(encoding='utf-8-sig')
        page.evaluate('''([text,preset]) => {
          csvSources=[parseSource(text,'CFCS_105.csv')];rebuildSources(false);
          applyTemplate(JSON.parse(preset));
        }''', [dataset,preset])
        graph.locator('#refresh').click()
        assert graph.evaluate('lastSnapshot.series.map(s=>s.points.length)') == [1200]*4
        assert graph.evaluate('lastSnapshot.series.map(s=>s.name.includes("Target_ID"))') == [True]*4
        page.close()
        graph.locator('#in').click()
        csv.locator('#followGraph').uncheck()
        csv.locator('#clear').click()
        assert not errors, errors
        print(entry, 'PASS CSV follow toggle, filtered-row reveal, graph popup selection, 2D/3D, independent zoom/pan, PNG names, refresh, survival after main closes')
        context.close()
    browser.close()
server.shutdown()
