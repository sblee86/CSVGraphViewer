"""Empty data-panel entry, local CSVs, and persistent multi-file reference rows."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1',0), partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for entry in ['source/index.html','CSVtoGraphViewer.html']:
        context = browser.new_context(viewport={'width':1440,'height':1000})
        page = context.new_page()
        errors = []
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/{entry}')
        page.evaluate('workspaceDialog.close()')
        with context.expect_page() as opened:
            page.locator('#dataCsvSeparateWindow').click()
        viewer = opened.value
        viewer.on('pageerror',lambda e: errors.append(str(e)))
        viewer.wait_for_selector('#localFiles',state='attached')
        assert viewer.locator('#search').is_disabled()
        assert viewer.locator('#pinRow').is_disabled()
        viewer.locator('#localFiles').set_input_files([
            {'name':'first.csv','mimeType':'text/csv','buffer':'T,V,V\n0,11,12\n1,21,22'.encode()},
            {'name':'second.csv','mimeType':'text/csv','buffer':'T,Other,V\n0,hello,51\n1,"<img src=x onerror=alert(1)>",61'.encode()},
        ])
        viewer.wait_for_function("document.querySelectorAll('#files option').length===2")
        # Right-click pins the hovered original row, not the previously selected row.
        viewer.locator('#files').select_option('0')
        viewer.locator('#grid [data-row="0"]').click(button='right')
        assert viewer.locator('#contextPin').inner_text() == '참고행 고정'
        viewer.locator('#contextPin').click()
        assert viewer.locator('#referenceRows tbody tr').count() == 1
        assert viewer.locator('#referenceRows tbody tr td').all_text_contents() == ['해제 first.csv / 1행','0','11','12']
        viewer.locator('#grid [data-row="1"] [data-cell="1"]').click()
        viewer.locator('#pinRow').click()
        viewer.locator('#files').select_option('1')
        viewer.locator('#grid [data-row="1"]').click(button='right')
        viewer.locator('#contextPin').click()
        assert viewer.locator('#referenceRows tbody tr').count() == 3
        # Same-named duplicate columns retain separate positions across files.
        assert viewer.locator('#referenceRows thead th').all_text_contents() == ['파일 / 원본 행','T','V','V','Other']
        assert viewer.locator('#referenceRows tbody tr').last.locator('td').all_text_contents() == ['해제 second.csv / 2행','1','61','—','<img src=x onerror=alert(1)>']
        assert viewer.locator('#referenceRows img').count() == 0
        viewer.locator('#search').fill('hello')
        viewer.wait_for_function("document.querySelectorAll('#grid tbody tr').length===1")
        assert viewer.locator('#referenceRows tbody tr').count() == 3
        viewer.locator('#referenceRows [data-unpin="1"]').click()
        assert viewer.locator('#referenceRows tbody tr').count() == 2
        viewer.locator('#clear').click()
        viewer.locator('#grid [data-row="1"]').click(button='right')
        assert viewer.locator('#contextPin').inner_text() == '참고행 고정 해제'
        viewer.keyboard.press('Escape')
        assert viewer.locator('#rowMenu').is_hidden()
        # Reopen from main with its CSVs; the fixed reference snapshots survive refresh.
        page.evaluate("csvSources=[parseSource('T,V\\n0,90\\n1,100','main.csv')];rebuildSources(false)")
        before = len(context.pages)
        page.locator('#dataCsvSeparateWindow').click()
        assert len(context.pages) == before
        assert viewer.locator('#files option').all_text_contents() == ['main.csv']
        assert viewer.locator('#referenceRows tbody tr').count() == 2
        page.close()
        viewer.locator('#clearReferences').click()
        assert viewer.locator('#referencePanel').is_hidden()
        assert not errors, errors
        print(entry,'PASS empty viewer, local multiple CSV, right-click pin, 3 reference rows, duplicate columns, safe values, filter independence, unpin, refresh preservation')
        context.close()
    browser.close()
server.shutdown()
