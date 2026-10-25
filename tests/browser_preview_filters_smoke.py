"""Requires Python playwright and /usr/bin/chromium."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for entry in ['source/index.html','CSVtoGraphViewer.html']:
  page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/{entry}')
  page.evaluate("""()=>{workspaceDialog.close();load(serializeCSV(['T','group','number'],Array.from({length:240},(_,i)=>[String(i),i===0?'':i%2?'B':'A',i%2?'10':'2'])),'test.csv');dataPreview.open=true;window.originalRows=csvSources[0].data;window.graphCount=filtered.length}""")
  page.locator('[data-preview-filter="1"]').click()
  assert page.locator('#previewValueList input').count()==3
  assert '고유값 3' in page.locator('#previewValueCount').inner_text()
  page.locator('#previewSelectAll').uncheck()
  page.locator('#previewValueSearch').fill('A')
  page.locator('#previewSelectAll').check()
  page.locator('#previewFilterApply').click()
  assert page.evaluate('previewTableRows(previewSource).length===119&&filtered.length===graphCount&&csvSources[0].data===originalRows')
  assert page.locator('#table tbody tr').count()==100
  page.locator('#previewNext').click()
  assert page.locator('#table tbody tr').count()==19
  page.locator('[data-preview-filter="0"]').click()
  page.locator('#previewSortDesc').click()
  assert page.evaluate('previewTableRows(previewSource)[0]===238')
  page.locator('[data-preview-filter="1"]').click()
  page.locator('#previewSelectAll').uncheck()
  page.locator('#previewFilterCancel').click()
  assert page.evaluate('previewTableRows(previewSource).length===119')
  # A second column filter composes with the first.
  page.locator('[data-preview-filter="0"]').click()
  page.locator('#previewSelectAll').uncheck()
  page.locator('#previewValueSearch').fill('238')
  page.locator('#previewSelectAll').check()
  page.locator('#previewFilterApply').click()
  assert page.evaluate('JSON.stringify(previewTableRows(previewSource))==="[238]"')
  # Graph selections restore hidden rows and use sorted/filtered page positions.
  page.evaluate('showPreviewHit({source:previewSource,localRow:239,columns:[2]})')
  page.wait_for_function("!!$('table').querySelector('[data-preview-row=\"239\"] .pickedValue')")
  assert page.evaluate('previewPage===0&&previewTableState(previewSource).filters.size===0')
  page.locator('#previewClearTable').click()
  page.locator('[data-preview-filter="2"]').click()
  page.locator('#previewSortAsc').click()
  assert page.evaluate('previewSource.data[previewTableRows(previewSource)[0]][2]==="2"')
  page.locator('[data-preview-filter="2"]').click()
  page.locator('#previewSortDesc').click()
  assert page.evaluate('previewSource.data[previewTableRows(previewSource)[0]][2]==="10"')
  # Empty selection means zero results rather than disabling filtering.
  page.locator('[data-preview-filter="1"]').click()
  page.locator('#previewSelectAll').uncheck()
  page.locator('#previewFilterApply').click()
  assert page.locator('#table tbody tr').count()==0
  assert page.locator('#previewNext').is_disabled()
  page.locator('[data-preview-filter="1"]').click()
  page.locator('#previewFilterClear').click()
  assert page.evaluate('previewTableRows(previewSource).length===240')
  # Menus close with Escape. High-cardinality lists offer lazy batches.
  page.locator('[data-preview-filter="0"]').click()
  assert page.locator('#previewValueList input').count()==200
  page.locator('#previewMoreValues').click()
  assert page.locator('#previewValueList input').count()==240
  page.keyboard.press('Escape')
  assert page.locator('#previewFilterMenu').is_hidden()
  assert not errors,errors
  print(entry,': PASS value lists, search, checkbox filters, AND, cancel, pagination, numeric sort, graph row identity, empty selection, reset, lazy list, keyboard close')
  page.close()
 browser.close()
server.shutdown()
