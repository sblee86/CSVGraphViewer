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
  page.evaluate("workspaceDialog.close();load('T,X,Y,Z\\n0,1,2,3\\n1,2,3,4','records.csv');openGraphSection('axes')")
  assert page.locator('#x').is_visible()
  assert page.locator('#columns').is_visible()
  assert page.locator('#yaxis3').is_hidden() and page.locator('#zaxis').is_hidden()
  assert page.locator('#taxis').is_visible()
  page.evaluate("$('yaxis3').value='2';$('zaxis').value='3';window.beforeSelected=[...selected];openGraphSection('kind')")
  page.locator('#dimension').select_option('3d');page.evaluate("openGraphSection('axes')")
  for name in ['x','yaxis3','zaxis','taxis']: assert page.locator('#'+name).is_visible()
  assert page.locator('#columns').is_hidden() and page.locator('#selection').is_hidden()
  assert page.locator('.fileXSection').is_hidden()
  assert page.locator('#yaxis3').locator('..').inner_text() .startswith('Y축')
  assert page.evaluate("!!($('x').compareDocumentPosition($('yaxis3'))&Node.DOCUMENT_POSITION_FOLLOWING)&&!!($('yaxis3').compareDocumentPosition($('zaxis'))&Node.DOCUMENT_POSITION_FOLLOWING)")
  page.evaluate("window.threeTemplate=captureTemplate();openGraphSection('kind')")
  page.locator('#dimension').select_option('2d');page.evaluate("openGraphSection('axes')")
  assert page.locator('#yaxis3').is_hidden() and page.locator('#columns').is_visible()
  assert page.evaluate("$('yaxis3').value==='2'&&$('zaxis').value==='3'&&JSON.stringify([...selected])===JSON.stringify(beforeSelected)")
  page.evaluate('applyTemplate(threeTemplate)')
  assert page.locator('#yaxis3').is_visible() and page.locator('#columns').is_hidden()
  page.locator('#templateTab').click();page.locator('#clearCurrentTemplate').click();page.evaluate("openGraphSection('axes')")
  assert page.locator('#yaxis3').is_hidden() and page.locator('#columns').is_visible()
  assert not errors,errors
  print(entry,': PASS 2D X/Y signals, 3D XYZ order, common T, hidden irrelevant controls, retained selection, template mode restore, clear template')
  page.close()
 browser.close()
server.shutdown()
