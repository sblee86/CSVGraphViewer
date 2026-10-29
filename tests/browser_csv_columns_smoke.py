"""Column chooser search, literal search emphasis, frozen columns, and global reset."""
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
        context = browser.new_context(viewport={'width':1440,'height':1000})
        page = context.new_page()
        errors=[]
        page.on('pageerror', lambda e:errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/{entry}')
        page.evaluate('''() => {
          workspaceDialog.close();
          const head=['Time','Target_ID','Range_m','RangeRate_mps','Note',...Array.from({length:15},(_,i)=>'Long_column_'+i)];
          const data=Array.from({length:130},(_,i)=>[String(i),i%2?'1002':'1001',String(200-i),String(i*2),i===120?'<img src=x onerror=alert(1)> Needle needle [a.b]':'normal',...Array.from({length:15},(_,j)=>'large value '+i+' column '+j)]);
          csvSources=[parseSource(serializeCSV(head,data),'track.csv'),parseSource('T,V\\n0,100\\n1,200','second.csv')];rebuildSources(false);
        }''')
        with context.expect_page() as opened:
            page.locator('#dataCsvSeparateWindow').click()
        viewer=opened.value
        viewer.on('pageerror',lambda e:errors.append(str(e)))
        viewer.wait_for_selector('#grid tbody tr')
        viewer.locator('#columns summary').click()
        viewer.locator('#columnSearch').fill('range')
        assert viewer.locator('#columnList [data-col]').count()==2
        viewer.locator('#uncheckMatchedColumns').click()
        assert viewer.locator('#grid th[data-column="2"]').count()==0
        assert viewer.locator('#columnSearch').input_value()=='range'
        viewer.locator('#checkMatchedColumns').click()
        assert viewer.locator('#grid th[data-column="2"]').count()==1
        viewer.locator('#columnList [data-col="3"]').uncheck()
        viewer.locator('#columnSearch').fill('does not exist')
        assert '일치하는 열 없음' in viewer.locator('#columnList').inner_text()
        viewer.locator('#columns summary').click()
        viewer.keyboard.press('Control+f')
        viewer.locator('#search').fill('needle')
        viewer.wait_for_function("document.querySelectorAll('#grid tbody tr').length===1")
        assert viewer.locator('#grid mark.search-match').all_text_contents()==['Needle','needle']
        assert int(viewer.locator('#grid mark').first.evaluate('e=>getComputedStyle(e).fontWeight'))>=700
        assert viewer.locator('#grid img').count()==0
        viewer.locator('#search').fill('[a.b]')
        viewer.wait_for_function("document.querySelector('#grid mark')?.textContent==='[a.b]'")
        viewer.locator('#clear').click()
        assert viewer.locator('#grid mark').count()==0
        # Freeze a non-leading column and another one. Verify positions after real horizontal scroll.
        for col in ['2','1']:
            viewer.locator('#grid th[data-column="'+col+'"]').click(button='right')
            viewer.locator('#contextFreeze').click()
        assert viewer.locator('#grid thead th[data-column]').evaluate_all('els=>els.slice(0,2).map(e=>e.dataset.column)')==['1','2']
        def lefts():
            return viewer.locator('#grid th.frozen-column').evaluate_all('els=>els.map(e=>e.getBoundingClientRect().left)')
        before=lefts()
        viewer.locator('#grid').evaluate('e=>{e.scrollLeft=700;e.scrollTop=300}')
        viewer.wait_for_timeout(100)
        assert all(abs(a-b)<1 for a,b in zip(before,lefts()))
        assert viewer.locator('#grid tbody tr').first.locator('td.frozen-column').count()==3
        # A header context menu must not pin a reference row.
        assert viewer.locator('#referenceRows tbody tr').count()==0
        viewer.locator('#grid th[data-column="2"]').click(button='right')
        assert viewer.locator('#contextFreeze').inner_text()=='열 고정 해제'
        viewer.locator('#contextFreeze').click()
        assert viewer.locator('#grid th[data-column="2"]').get_attribute('class') is None
        viewer.locator('#grid').evaluate('e=>{e.scrollTop=0;e.scrollLeft=0}')
        viewer.wait_for_timeout(100)
        viewer.locator('#grid [data-row="0"] [data-cell="1"]').click(button='right')
        viewer.locator('#contextPin').click()
        # Apply a real checkbox filter and descending sort before clearing all files.
        viewer.locator('[data-filter="1"]').click()
        viewer.locator('#selectValues').uncheck()
        viewer.locator('#valueSearch').fill('1001')
        viewer.locator('#selectValues').check()
        viewer.locator('#filterApply').click()
        assert '표시 65행' in viewer.locator('#counts').inner_text()
        viewer.locator('[data-filter="2"]').click()
        viewer.locator('#sortDesc').click()
        viewer.locator('#files').select_option('1')
        viewer.locator('#search').fill('200')
        viewer.wait_for_function("document.querySelectorAll('#grid tbody tr').length===1")
        viewer.locator('#resetAll').click()
        assert viewer.locator('#grid tbody tr').count()==2
        viewer.locator('#files').select_option('0')
        assert '표시 130행' in viewer.locator('#counts').inner_text()
        assert viewer.locator('#grid th[data-column]').count()==20
        assert viewer.locator('#grid [data-row]').first.get_attribute('data-row')=='0'
        assert viewer.locator('#grid th[data-column="1"]').get_attribute('class')=='frozen-column'
        assert viewer.locator('#referenceRows tbody tr').count()==1
        viewer.locator('#columns summary').click()
        assert viewer.locator('#columnSearch').input_value()==''
        assert not errors,errors
        print(entry,'PASS chooser search+checkboxes, case-insensitive/literal highlight, safe HTML, multi-column freeze, row pin coexistence, all-file reset')
        context.close()
    browser.close()
server.shutdown()
