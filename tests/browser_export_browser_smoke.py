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
   workspaceDialog.close();load('T,Y\\n0,1\\n1,2','original.csv');window.originalGraph=csvSources;
   const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5XkAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
   window.files=new Map([
    ['image.png',new File([png],'image.png',{type:'image/png'})],
    ['image(1).PNG',new File([png],'image(1).PNG',{type:'image/png'})],
    ['records.csv',new File([serializeCSV(['T','<field>'],Array.from({length:205},(_,i)=>[String(i),'value,'+i]))],'records.csv')],
    ['failed.csv',new File(['T,Y\\n0,1'],'failed.csv')],
    ['ignore.txt',new File(['keep'],'ignore.txt')]
   ]);
   window.deleted=[];
   const dir={async *entries(){for(const [name] of files)yield [name,{kind:'file',getFile:async()=>files.get(name)}];yield ['subfolder',{kind:'directory'}]},removeEntry:async name=>{if(name==='failed.csv')throw new DOMException('Permission denied','NotAllowedError');deleted.push(name);files.delete(name)}};
   workRoot={name:'work',getDirectoryHandle:async name=>{if(name!=='내보내기')throw Error('Wrong scope');return dir}};
  }""")
  page.locator('#reset').click()
  page.wait_for_function('exportBrowserFiles.length===4')
  assert page.locator('[data-export-file]').count()==2
  page.locator('[data-export-file="image.png"]').click()
  page.wait_for_function("!!$('exportPreviewContent').querySelector('img')?.complete")
  assert page.locator('#exportOpenFile').get_attribute('href').startswith('blob:')
  page.locator('[data-export-check="image.png"]').check()
  page.once('dialog',lambda d:d.dismiss());page.locator('#exportDeleteChecked').click()
  assert page.evaluate("files.has('image.png')")
  page.locator('#exportTabCsv').click()
  assert page.locator('[data-export-file]').count()==2
  assert page.locator('#exportDeleteChecked').is_disabled()
  page.locator('[data-export-file="records.csv"]').click()
  page.wait_for_function('exportCsvData?.length===206')
  assert page.locator('#exportPreviewContent tbody tr').count()==100
  assert page.locator('#exportPreviewContent th').nth(2).inner_text()=='<field>'
  assert page.locator('#exportPreviewContent img').count()==0
  page.locator('#exportCsvNext').click();page.locator('#exportCsvNext').click()
  assert page.locator('#exportPreviewContent tbody tr').count()==5
  assert '205행' in page.locator('#exportCsvPageInfo').inner_text()
  page.locator('#exportCheckAll').check()
  page.once('dialog',lambda d:d.accept());page.locator('#exportDeleteChecked').click()
  page.wait_for_function("!exportDeleteBusy&&$('exportBrowserStatus').textContent.includes('실패 1개')")
  assert page.evaluate("!files.has('records.csv')&&files.has('failed.csv')&&files.has('image.png')&&files.has('ignore.txt')")
  assert page.locator('[data-export-check="failed.csv"]').is_checked()
  assert page.locator('#exportOpenFile').is_hidden()
  page.locator('#exportTabPng').click()
  assert page.locator('[data-export-check="image.png"]').is_checked()
  page.once('dialog',lambda d:d.accept());page.locator('#exportDeleteChecked').click()
  page.wait_for_function("!exportDeleteBusy&&!files.has('image.png')")
  assert page.evaluate('csvSources===originalGraph')
  # A delayed read must not replace a newer preview or leave a leaked URL.
  page.evaluate("""async()=>{
   let finish;exportBrowserFiles.push({name:'slow.png',handle:{getFile:()=>new Promise(r=>finish=()=>r(new File(['slow'],'slow.png')))}});
   const pending=previewExportFile('slow.png');setExportBrowserTab('csv');finish();await pending;
   if(exportPreviewName!==null||exportPreviewUrl!==null)throw Error('Stale preview');
  }""")
  page.locator('#exportBrowserClose').click()
  assert page.locator('#exportBrowser').is_hidden()
  # Missing export directory is an empty list, not an error or a created folder.
  page.evaluate("workRoot={name:'empty',getDirectoryHandle:async()=>{throw new DOMException('Missing','NotFoundError')}}")
  page.locator('#reset').click()
  page.wait_for_function("$('exportBrowserStatus').textContent.includes('0개')")
  assert page.locator('[data-export-file]').count()==0
  page.keyboard.press('Escape')
  assert not errors,errors
  print(entry,': PASS PNG/CSV tabs, image preview, CSV pagination/escaping, file links, selected delete/cancel/failure, scope protection, stale read, empty folder, close')
  page.close()
 browser.close()
server.shutdown()
