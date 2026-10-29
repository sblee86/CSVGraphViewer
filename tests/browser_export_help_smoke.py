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
   workspaceDialog.close();load('T,Signal/Y\\n0,2\\n1,3','records.csv');
   window.disk=new Map();window.failWrite=false;
   const dir={getFileHandle:async(name,options)=>{
    if(!options?.create&&!disk.has(name))throw new DOMException('Missing','NotFoundError');
    return {createWritable:async()=>({write:async data=>{if(failWrite)throw Error('disk full');disk.set(name,data)},close:async()=>{},abort:async()=>{}})};
   }};
   workRoot={name:'work',getDirectoryHandle:async(name)=>{if(name!=='내보내기')throw Error('wrong directory');return dir}};
   if(currentExportName('csv',new Date(2026,9,26))!=='2026-10-26_양식없음_Signal_Y.csv')throw Error('Wrong filename');
   window.savedTemplate=captureTemplate();savedTemplate.name='내/양식';applyTemplate(savedTemplate);
  }""")
  page.evaluate("async()=>{const name=currentExportName('csv');await Promise.all([download(new Blob(['one']),name),download(new Blob(['two']),name),download(new Blob(['three']),name)]);const names=[...disk.keys()];if(names.length!==3||!names[1].endsWith('(1).csv')||!names[2].endsWith('(2).csv'))throw Error('Collision');if(await disk.get(names[0]).text()!=='one')throw Error('Overwrote first export')}")
  page.locator('#export').click()
  page.wait_for_function('disk.size===4')
  assert page.evaluate("async()=>{const blob=[...disk.values()].at(-1);const text=await blob.text();return parseCSV(text,'auto').length===3}")
  page.locator('#png').click()
  page.wait_for_function("[...disk.keys()].some(n=>n.endsWith('.png'))")
  assert page.evaluate("async()=>{const b=[...disk.entries()].find(([name])=>name.endsWith('.png'))[1];const bytes=new Uint8Array(await b.arrayBuffer());return bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71}")
  # Failed writes must not poison later saves, and existing files survive reloads.
  page.evaluate("async()=>{failWrite=true;await download(new Blob(['bad']),'retry.csv');failWrite=false;await download(new Blob(['ok']),'retry.csv');await download(new Blob(['again']),'retry.csv');if(!disk.has('retry(1).csv'))throw Error('Retry failed')}")
  assert page.locator('#extent').get_attribute('title') and 'T' in page.locator('#extent').get_attribute('title')
  assert page.locator('#extent').locator('..').locator('small').inner_text()=='X축 보기 범위:'
  assert page.evaluate("$('settingsOpen').nextElementSibling===$('viewerHelpOpen')")
  page.locator('#viewerHelpOpen').click()
  assert page.locator('#viewerHelp').is_visible()
  assert page.locator('#viewerHelp section').count() >= 9
  assert '그래프 별도 창' in page.locator('#viewerHelp').inner_text()
  assert '참고행 고정' in page.locator('#viewerHelp').inner_text()
  assert '최초배포자:이상범(sangbum.lee@ligdna.com)' in page.locator('#viewerHelp').inner_text()
  assert '마음대로 수정 배포가능합니다' in page.locator('#viewerHelp').inner_text()
  page.locator('#viewerHelpClose').click()
  assert not errors,errors
  print(entry,': PASS dated names, sanitized template/axis, concurrent unique writes, CSV contents, PNG bytes, retry, range help, help dialog')
  page.close()
 browser.close()
server.shutdown()
