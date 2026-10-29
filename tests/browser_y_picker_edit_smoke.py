"""Separate Y pickers, searchable conditional columns, and isolated CSV value editing."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import csv
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for entry in ['source/index.html','CSVtoGraphViewer.html']:
        context=browser.new_context(viewport={'width':1440,'height':1000})
        page=context.new_page(); errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/{entry}')
        page.evaluate("workspaceDialog.close();csvSources=[parseSource('Time,Target_ID,Range_m,Note\\n0,1001,50,first\\n1,1002,60,second\\n2,1001,70,third','track.csv')];rebuildSources(false);openGraphSection('y')")
        assert page.locator('#columns').is_visible()
        assert page.locator('#conditionalYColumn').is_hidden()
        page.locator('#ySignalPage-conditional').click()
        assert page.locator('#columns').is_hidden()
        search=page.get_by_role('searchbox',name='추가할 Y열 검색')
        search.fill('Range')
        page.locator('#conditionalYColumn').select_option('2')
        page.locator('#addConditionalSignal').click()
        assert page.locator('.conditionalSignalCard').count()==1
        page.get_by_role('searchbox',name='조건 열 검색').fill('target')
        assert page.locator('[data-condition-col] option').count()==1
        page.locator('[data-condition-col]').select_option('1')
        page.locator('[data-condition-value]').fill('1001')
        page.locator('[data-apply-signal]').click()
        assert page.evaluate('seriesRows([...selected].find(i=>columnMeta[i]?.signalId)).length')==2
        page.locator('#ySignalPage-ordinary').click()
        assert page.locator('#columns').is_visible()
        assert page.locator('.conditionalSignalCard').is_hidden()
        page.locator('#ySignalPage-conditional').click()
        assert page.locator('[data-condition-value]').input_value()=='1001'
        with context.expect_page() as opened:
            page.locator('#previewSeparateWindow').click()
        viewer=opened.value
        viewer.on('pageerror',lambda e:errors.append(str(e)))
        viewer.wait_for_selector('#grid tbody tr')
        assert not viewer.locator('#csvEditMode').is_checked()
        cell=viewer.locator('#grid [data-row="0"] [data-cell="2"]')
        cell.click()
        assert viewer.locator('.csvCellEditor').count()==0
        viewer.locator('#pinRow').click()
        viewer.locator('#csvEditMode').check()
        cell.click()
        viewer.locator('.csvCellEditor').fill('123.45')
        viewer.locator('.csvCellEditor').press('Enter')
        assert cell.inner_text()=='123.45'
        assert '50' in viewer.locator('#referenceRows').inner_text()
        assert page.evaluate('csvSources[0].data[0][2]')=='50'
        cell.click()
        viewer.locator('.csvCellEditor').fill('cancelled')
        viewer.locator('.csvCellEditor').press('Escape')
        assert cell.inner_text()=='123.45'
        viewer.locator('#grid [data-row="1"] [data-cell="3"]').click()
        viewer.locator('.csvCellEditor').fill('<img src=x onerror=alert(1)>,한글')
        viewer.locator('.csvCellEditor').press('Enter')
        assert viewer.locator('#grid img').count()==0
        viewer.locator('#csvEditMode').uncheck()
        viewer.locator('#search').fill('123.45')
        viewer.wait_for_function("document.querySelectorAll('#grid tbody tr').length===1")
        with viewer.expect_download() as downloaded:
            viewer.locator('#saveEditedCsv').click()
        with open(downloaded.value.path(),encoding='utf-8-sig',newline='') as stream:
            records=list(csv.reader(stream))
        assert len(records)==4 and len(records[0])==4
        assert records[1][2]=='123.45'
        assert records[2][3]=='<img src=x onerror=alert(1)>,한글'
        assert downloaded.value.suggested_filename=='track_수정본.csv'
        viewer.locator('#clear').click()
        viewer.locator('#csvEditMode').check()
        cell.click();viewer.locator('.csvCellEditor').fill('999');viewer.locator('.csvCellEditor').press('Enter')
        viewer.on('dialog',lambda dialog:dialog.dismiss())
        page.locator('#previewSeparateWindow').click()
        assert cell.inner_text()=='999'
        assert not errors,errors
        print(entry,'PASS separate Y modes, column search/list, rule preservation, opt-in value edit, Enter/Escape, original/reference isolation, safe text, full CSV save, unsaved refresh protection')
        context.close()
    browser.close()
server.shutdown()
