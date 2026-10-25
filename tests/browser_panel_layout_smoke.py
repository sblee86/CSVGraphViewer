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
  page.evaluate("""()=>{workspaceDialog.close();load('T,Y\\n'+Array.from({length:200},(_,i)=>i+','+(i+1)).join('\\n'),'records.csv');window.settingsText='';workRoot={getFileHandle:async()=>({createWritable:async()=>({write:async text=>settingsText=text,close:async()=>{}}),getFile:async()=>({text:async()=>settingsText})})}}""")
  assert page.locator('.buildLabel').inner_text().startswith('v1.')
  assert '브라우저 로컬 분석' not in page.locator('header').inner_text()
  assert page.evaluate('graphDisclosure.open')
  page.locator('#graphDisclosure>summary').click()
  page.wait_for_function('viewerPrefs.graphCollapsed')
  page.wait_for_function("settingsText&&JSON.parse(settingsText).preferences.graphCollapsed")
  page.locator('#graphDisclosure>summary').click()
  page.wait_for_function('!viewerPrefs.graphCollapsed')
  page.evaluate('dataPreview.open=true')
  page.locator('#previewPin').click()
  page.wait_for_function('viewerPrefs.previewPinned')
  assert page.evaluate("dataPreview.parentElement===document.querySelector('main')&&dataPreview.open")
  # Dock stays at the bottom as the upper graph content scrolls.
  state=page.evaluate("""()=>{const pane=document.querySelector('main'),scroll=document.querySelector('.mainGraphScroll');const y=dataPreview.getBoundingClientRect().bottom;scroll.scrollTop=200;if(Math.abs(dataPreview.getBoundingClientRect().bottom-y)>1)throw Error('Dock moved');const box=$('table').getBoundingClientRect(),dock=dataPreview.getBoundingClientRect();return {tableBottom:box.bottom,dockBottom:dock.bottom,tableHeight:box.height}}""")
  assert state['tableHeight']>20 and state['tableBottom']<=state['dockBottom']+2,state
  grip=page.locator('#previewDockResize');grip.focus();page.keyboard.press('ArrowUp')
  assert page.evaluate('viewerPrefs.previewHeight===330')
  bounds=grip.bounding_box();page.mouse.move(bounds['x']+20,bounds['y']+3);page.mouse.down();page.mouse.move(bounds['x']+20,bounds['y']-37);page.mouse.up()
  page.wait_for_function('viewerPrefs.previewHeight>=365')
  page.wait_for_function("JSON.parse(settingsText).preferences.previewPinned&&JSON.parse(settingsText).preferences.previewHeight>=365")
  # Restore from the actual persisted JSON through the existing settings reader.
  saved=page.evaluate('JSON.parse(settingsText).preferences')
  page.evaluate('viewerPrefs={...viewerDefaults};applyViewerPrefs()')
  assert not page.evaluate('viewerPrefs.previewPinned')
  page.evaluate('readWorkspaceSettings(workRoot)')
  assert page.evaluate('viewerPrefs.previewPinned&&dataPreview.parentElement===mainPane')
  assert page.evaluate('viewerPrefs.previewHeight')==saved['previewHeight']
  page.locator('#settingsOpen').click();page.locator('#pref-previewPinned').select_option('false')
  assert not page.evaluate('mainPane.classList.contains("previewDocked")')
  page.locator('#prefsCancel').click()
  assert page.evaluate('viewerPrefs.previewPinned&&mainPane.classList.contains("previewDocked")')
  page.locator('#previewPin').click()
  assert page.evaluate('dataPreview.parentElement===mainContent&&!viewerPrefs.previewPinned')
  page.evaluate("window.oldDownload=download;window.savedPng=null;download=async blob=>{savedPng=blob};viewerPrefs.graphCollapsed=true;applyViewerPrefs()")
  page.locator('#png').click()
  page.wait_for_function('savedPng!==null&&graphDisclosure.open')
  assert page.evaluate("savedPng.size>50&&$('plot').width>0&&$('plot').height>0")
  page.evaluate('download=oldDownload')
  assert not errors,errors
  print(entry,': PASS build stamp, graph collapse/expand/autosave, preview docking, inner table size, keyboard/drag resize, JSON restore, settings cancel, unpin')
  page.close()
 browser.close()
server.shutdown()
