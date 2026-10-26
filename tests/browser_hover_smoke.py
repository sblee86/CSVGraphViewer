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
  page.evaluate("""()=>{
   workspaceDialog.close();load('T,Low,High\\n0,0,10\\n1,0,10\\n2,0,10','signals.csv');selected=new Set([1,2]);manualY=[-1,11];view=[0,2];update();
   window.hoverAt=(x,y,index=0)=>{const p=panels[index],b=$('plot').getBoundingClientRect();$('plot').onpointermove({clientX:b.left+p.left+(x-p.xr[0])/(p.xr[1]-p.xr[0])*(p.right-p.left),clientY:b.top+p.bottom-(y-p.yr[0])/(p.yr[1]-p.yr[0])*(p.bottom-p.top)});return {text:$('tooltip').textContent,visible:$('tooltip').style.display!=='none'}};
  }""")
  hit=page.evaluate('hoverAt(1,10)');assert hit['visible'] and 'High' in hit['text'] and 'Low' not in hit['text'] and 'Y 10' in hit['text']
  hit=page.evaluate('hoverAt(1,0)');assert hit['visible'] and 'Low' in hit['text'] and 'High' not in hit['text']
  assert not page.evaluate('hoverAt(1,5)')['visible']
  page.evaluate('selected=new Set([2,1]);draw()')
  assert 'High' in page.evaluate('hoverAt(.5,10)')['text']
  page.evaluate("$('style').value='scatter';draw()")
  assert not page.evaluate('hoverAt(.5,10)')['visible']
  assert page.evaluate('hoverAt(1,10)')['visible']
  page.evaluate("$('style').value='line';$('timeMode').value='trail';$('timeSlider').value='0';draw()")
  assert not page.evaluate('hoverAt(1,10)')['visible']
  page.evaluate("$('timeMode').value='all';csvSources=[parseSource('T,Low,High\\n0,0,10\\n1,,10\\n2,0,10','gap.csv')];rebuildSources(false);selected=new Set([1]);manualY=[-1,11];view=[0,2];draw()")
  assert not page.evaluate('hoverAt(1,0)')['visible']
  page.evaluate("csvSources=[parseSource('T,A\\n0,0\\n1,0\\n2,0','a.csv'),parseSource('T,B\\n0,10\\n1,10\\n2,10','b.csv')];rebuildSources(false);selected=new Set([1,3]);manualY=[-1,11];view=[0,2];draw()")
  hit=page.evaluate('hoverAt(1,10)');assert hit['visible'] and 'b.csv / B' in hit['text'] and 'a.csv' not in hit['text'] and '데이터 행 2' in hit['text']
  page.evaluate("$('layout').value='split';draw()")
  assert 'a.csv / A' in page.evaluate('hoverAt(1,0,0)')['text']
  assert 'b.csv / B' in page.evaluate('hoverAt(1,10,1)')['text']
  assert not errors,errors
  print(entry,': PASS single nearest signal, reversed selection order, empty areas, sparse lines, scatter, T trail, missing-value gaps, source row identity, split panels')
  page.close()
 browser.close()
server.shutdown()
