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
  page.evaluate('''()=>{
   workspaceDialog.close();load('T,Y\\n0,1\\n1,2\\n2,3','test.csv');
   const bar=document.querySelector('.graphSummaryBar');
   if(!['total','filtered','signals','extent','zoom','pan','autoAxisBounds'].every(id=>bar.contains($(id))))throw Error('Missing summary control');
   const centers=[...bar.querySelectorAll('.metrics>div,.mode')].map(e=>{const r=e.getBoundingClientRect();return r.top+r.height/2});
   if(Math.max(...centers)-Math.min(...centers)>2)throw Error('Not one row');
   if(JSON.stringify([...bar.querySelectorAll('.mode button')].map(b=>b.id))!==JSON.stringify(['autoAxisBounds','applyUserAxisBounds','zoom','pan']))throw Error('Wrong action order');
   if([...bar.querySelectorAll('.metrics small')].some(e=>!e.textContent.endsWith(':')))throw Error('Missing metric colon');
   window.originalBarHeight=bar.getBoundingClientRect().height;
   window.settingsText='';workRoot={getFileHandle:async()=>({createWritable:async()=>({write:async text=>settingsText=text,close:async()=>{}}),getFile:async()=>({text:async()=>settingsText})})};
   conditions=[{col:1,min:'2',max:''}];view=[.5,1.5];manualY=[1,2];$('xmin').value='.5';update();
  }''')
  page.locator('#pan').click();assert page.evaluate('pan')
  page.locator('#zoom').click();assert not page.evaluate('pan')
  page.locator('#autoAxisBounds').click()
  assert page.evaluate("view===null&&manualY===null&&$('xmin').value==='.5'&&conditions.length===1&&filtered.length===2")
  page.evaluate("$('xmin').value='0';$('xmax').value='3';$('ymin').value='1';$('ymax').value='5'")
  page.locator('#applyUserAxisBounds').click()
  assert page.evaluate('JSON.stringify(view)==="[0,3]"&&JSON.stringify(manualY)==="[1,5]"')
  page.locator('#autoAxisBounds').click()
  assert page.evaluate("view===null&&manualY===null&&$('xmax').value==='3'")
  page.locator('#applyUserAxisBounds').click()
  assert page.evaluate('JSON.stringify(view)==="[0,3]"')
  page.evaluate("$('dimension').value='3d';scale3=4;offset3=[50,50];angleYaw=.8;draw()")
  page.locator('#autoAxisBounds').click()
  assert page.evaluate('scale3===1&&offset3.every(v=>v===0)&&angleYaw===.8')
  page.locator('#settingsOpen').click()
  page.locator('#pref-summarySize').fill('60')
  assert page.evaluate("document.querySelector('.graphSummaryBar').getBoundingClientRect().height<originalBarHeight")
  page.locator('#prefsCancel').click()
  assert page.evaluate('viewerPrefs.summarySize===100')
  page.locator('#settingsOpen').click();page.locator('#pref-summarySize').fill('65')
  page.locator('#prefsSave').click()
  page.wait_for_function("!settingsDialog.open&&JSON.parse(settingsText).preferences.summarySize===65")
  page.evaluate('viewerPrefs={...viewerDefaults}')
  page.evaluate('readWorkspaceSettings(workRoot)')
  assert page.evaluate("viewerPrefs.summarySize===65&&document.body.style.getPropertyValue('--summary-scale')==='0.65'&&normalizePrefs({uiSize:13}).summarySize===100")
  page.evaluate('''()=>{for(const button of document.querySelectorAll('.graphSummaryBar .mode button')){const text=button.querySelector('.graphActionLabel'),css=getComputedStyle(button),expected=(text.getBoundingClientRect().width+parseFloat(css.paddingLeft)+parseFloat(css.paddingRight))*1.2;if(Math.abs(button.getBoundingClientRect().width-expected)>2)throw Error('Incorrect button width')}}''')
  # At narrow widths controls remain in one horizontally scrollable row.
  page.set_viewport_size({'width':800,'height':900})
  assert page.evaluate("getComputedStyle(document.querySelector('.graphSummaryBar')).flexWrap==='nowrap'&&getComputedStyle(document.querySelector('.graphSummaryBar')).overflowX==='auto'")
  assert not errors,errors
  print(entry,': PASS one-row metrics/actions, 2D/3D auto bounds, filters retained, size preview/cancel/save/reload, old preferences, narrow layout')
  page.close()
 browser.close()
server.shutdown()
