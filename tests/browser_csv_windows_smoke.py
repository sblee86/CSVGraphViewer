"""Multiple CSV windows, file tabs, compact mode, graph broadcast, and PiP lifecycle."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for entry in ['source/index.html','CSVtoGraphViewer.html']:
        context=browser.new_context(viewport={'width':1440,'height':1000})
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/{entry}')
        page.evaluate("workspaceDialog.close();csvSources=[parseSource('T,V\\n0,10\\n1,20','first.csv'),parseSource('T,V\\n0,30\\n1,40','second.csv')];rebuildSources(false)")
        with context.expect_page() as opened:page.locator('#dataCsvSeparateWindow').click()
        first=opened.value
        first.on('pageerror',lambda e:errors.append(str(e)))
        first.wait_for_selector('#csvFileTabs [role=tab]')
        assert first.locator('#csvFileTabs [role=tab]').all_text_contents()==['first.csv','second.csv']
        first.locator('[data-file-tab="1"]').click()
        assert first.locator('#files').input_value()=='1'
        with context.expect_page() as opened:first.locator('#newCsvWindow').click()
        second=opened.value
        second.on('pageerror',lambda e:errors.append(str(e)))
        second.wait_for_selector('#grid tbody tr')
        assert second.locator('#csvFileTabs [role=tab]').all_text_contents()==['second.csv']
        second.locator('#localFiles').set_input_files({'name':'third.csv','mimeType':'text/csv','buffer':b'T,V\n0,50\n1,60'})
        second.wait_for_function("document.querySelectorAll('#csvFileTabs [role=tab]').length===2")
        assert first.locator('#csvFileTabs [role=tab]').count()==2
        page.evaluate('showPreviewHit({source:csvSources[1],localRow:1,columns:[1]})')
        assert first.locator('#grid .selected-row').get_attribute('data-row')=='1'
        assert second.locator('#grid .picked-cell').inner_text()=='40'
        second.locator('#followGraph').uncheck()
        second.locator('[data-file-tab="1"]').click()
        page.evaluate('showPreviewHit({source:csvSources[0],localRow:0,columns:[1]})')
        assert second.locator('#files').input_value()=='1'
        with context.expect_page() as opened:page.locator('#newDataCsvWindow').click()
        third=opened.value
        third.wait_for_selector('#grid tbody tr')
        assert len(context.pages)==4
        third.locator('#compactView').check()
        assert third.locator('body').evaluate("e=>e.classList.contains('compact')")
        # Unsupported browsers give feedback instead of pretending the window is pinned.
        third.evaluate("Object.defineProperty(window,'documentPictureInPicture',{configurable:true,value:undefined})")
        third.locator('#alwaysOnTop').click()
        assert not third.locator('#alwaysOnTop').is_checked()
        assert '지원하지' in third.locator('#status').inner_text()
        # Emulate the window provider to validate real DOM transfer and restoration in CI.
        third.evaluate("Object.defineProperty(window,'documentPictureInPicture',{configurable:true,value:{requestWindow:async()=>window.open('','_blank','popup,width=900,height=650')}})")
        with context.expect_page() as opened:third.locator('#alwaysOnTop').click()
        pip=opened.value
        pip.on('pageerror',lambda e:errors.append(str(e)))
        pip.wait_for_selector('#grid tbody tr')
        assert pip.locator('#csvFileTabs [role=tab]').count()==2
        assert third.locator('#grid').count()==0
        pip.locator('[data-file-tab="1"]').click()
        pip.keyboard.press('Control+f')
        assert pip.locator('#search').evaluate('e=>e===e.ownerDocument.activeElement')
        pip.locator('#search').fill('40')
        pip.wait_for_function("document.querySelectorAll('#grid tbody tr').length===1")
        pip.locator('#clear').click()
        pip.locator('#csvEditMode').check()
        pip.locator('#grid [data-row="1"] [data-cell="1"]').click()
        pip.locator('.csvCellEditor').fill('444')
        pip.locator('.csvCellEditor').press('Enter')
        third.get_by_role('button',name='항상 위 창 닫고 기본 창으로 돌아오기').click()
        third.wait_for_selector('#grid tbody tr')
        assert third.locator('#grid [data-row="1"] [data-cell="1"]').inner_text()=='444'
        assert third.locator('body').evaluate("e=>e.classList.contains('compact')")
        assert not third.locator('#alwaysOnTop').is_checked()
        second.locator('[data-close-tab="1"]').click()
        assert second.locator('#csvFileTabs [role=tab]').count()==1
        page.close()
        first.locator('#localFiles').set_input_files({'name':'after.csv','mimeType':'text/csv','buffer':b'T,V\n0,70'})
        first.wait_for_function("document.querySelectorAll('#csvFileTabs [role=tab]').length===3")
        assert not errors,errors
        print(entry,'PASS independent windows, file tabs/add/close, graph broadcast, compact mode, unsupported PiP feedback, simulated PiP DOM/event/edit restoration, main-close survival')
        context.close()
    browser.close()
server.shutdown()
