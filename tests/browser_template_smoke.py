# Requires Python playwright and /usr/bin/chromium. Run from any directory.
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for entry in ['source/index.html','CSVtoGraphViewer.html']:
  page=b.new_page(viewport={'width':1440,'height':1000});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base+entry)
  page.evaluate("workspaceDialog.close(); workRoot={name:'긴작업폴더'}")
  page.evaluate('''async()=>{
   const data='T,X,Y,Z\\n0,1,2,3\\n1,4,5,6';
   workspaceCsv=['하위/a.csv','하위/b.csv'].map(path=>({path,handle:{getFile:async()=>new File([data],path)}}));
   await addSourceFiles(workspaceCsv);
   if(headers.some(h=>h.includes('긴작업폴더')))throw Error('root prefix leaked');
   if(!headers.includes('하위/a.csv / Y'))throw Error('relative label missing');
   selected=new Set([2,6]);$('x').value='0';$('x').onchange();
   $('templateName').value='두 파일';window.saved=captureTemplate();
   if(saved.selected[0].file!=='하위/a.csv'||saved.selected[0].column!=='Y')throw Error('saved identity wrong');
   csvSources=[];templatePending=null;rebuildSources(false);
   templates=[{name:saved.name,data:saved}];renderTemplates();
  }''')
  page.locator('#templateTab').click()
  page.locator('[data-template="0"]').click()
  page.wait_for_function('csvSources.length===2&&selected.size===2')
  assert page.evaluate("[...selected].every(i=>columnRef(i).column==='Y')")
  page.evaluate('''async()=>{
   // Renamed workspace / moved subfolders: unique filenames still reconnect.
   workspaceCsv=workspaceCsv.map(e=>({...e,path:e.path.replace('하위/','새폴더/')}));
   await openWorkspaceTemplate(saved);
   if(csvSources[0].path!=='새폴더/a.csv'||[...selected].some(i=>columnRef(i).column!=='Y'))throw Error('filename fallback failed');
   // Missing or ambiguous files must leave the previous graph untouched.
   const previous=csvSources;
   workspaceCsv=[...workspaceCsv,{...workspaceCsv[0],path:'다른폴더/a.csv'}];
   await openWorkspaceTemplate(saved);
   if(csvSources!==previous||!$('multiWarning').textContent.includes('여러 개'))throw Error('ambiguity guard failed');
   workspaceCsv=[];await openWorkspaceTemplate(saved);
   if(csvSources!==previous||!$('multiWarning').textContent.includes('파일 없음'))throw Error('missing guard failed');
   // Latest template selection wins when an earlier disk read finishes later.
   let finish;
   workspaceCsv=[{path:'하위/a.csv',handle:{getFile:()=>new Promise(r=>finish=()=>r(new File(['T,X,Y,Z\\n0,1,2,3'],'a.csv')))}},{path:'하위/b.csv',handle:{getFile:async()=>new File(['T,X,Y,Z\\n0,1,2,3'],'b.csv')}}];
   const pending=openWorkspaceTemplate(saved);
   const legacy={...saved,files:[],fileX:[],x:{row:true},y:null,z:null,t:{row:true},selected:[{name:'Y'}],conditions:[]};
   await openWorkspaceTemplate(legacy);finish();await pending;
   if(csvSources!==previous)throw Error('stale request replaced graph');
  }''')
  # Load provided real data and preserve backwards-compatible 3D templates.
  page.locator('#file').set_input_files(str(root/'예제_3D_궤적.csv'))
  page.wait_for_function('rows.length>=1000')
  template=json.loads((root/'양식/3D/3D-궤적.json').read_text())
  page.evaluate('(t)=>openWorkspaceTemplate(t)',template)
  assert page.locator('#dimension').input_value()=='3d'
  page.evaluate("""()=>{
   window.deleteLog=[];
   window.templateDisk=new Map(['양식/첫양식.json','양식/하위/둘째양식.json','양식/실패.json'].map(path=>[path,{name:path.includes('둘째')?'둘째':'첫째',path,data:saved}]));
   function directory(prefix=''){return {getDirectoryHandle:async name=>directory(prefix+name+'/'),removeEntry:async name=>{const path=prefix+name;if(path==='양식/실패.json')throw new DOMException('쓰기 권한 없음','NotAllowedError');if(!templateDisk.has(path))throw new DOMException('없음','NotFoundError');deleteLog.push(path);templateDisk.delete(path)}}}
   workRoot=directory();workspaceEpoch++;
   refreshWorkspace=async()=>{templates=[...templateDisk.values()];renderTemplates()};
   templates=[...templateDisk.values()];renderTemplates();showTab('template');
   window.previousGraph=csvSources;
  }""")
  assert page.locator('#deleteSelectedTemplates').is_disabled()
  page.locator('[data-check-template="0"]').check()
  page.once('dialog',lambda d:d.dismiss())
  page.locator('#deleteSelectedTemplates').click()
  assert page.evaluate('templateDisk.size')==3
  page.locator('[data-check-template="1"]').check()
  page.locator('#templateSearch').fill('둘째')
  assert page.locator('#templateSelectionCount').inner_text()=='2개 선택'
  page.once('dialog',lambda d:d.accept())
  page.locator('#deleteSelectedTemplates').click()
  page.wait_for_function('!templateDeleteBusy&&templateDisk.size===1')
  assert page.evaluate("JSON.stringify(deleteLog)===JSON.stringify(['양식/첫양식.json','양식/하위/둘째양식.json'])")
  assert page.evaluate('csvSources===previousGraph')
  page.locator('#templateSearch').fill('')
  page.locator('[data-check-template="0"]').check()
  page.once('dialog',lambda d:d.accept())
  page.locator('#deleteSelectedTemplates').click()
  page.wait_for_function("!templateDeleteBusy&&$('toast').textContent.includes('실패 1개')")
  assert page.locator('[data-check-template="0"]').is_checked()
  assert page.evaluate("!deletableTemplatePath('양식/../data.csv')&&!deletableTemplatePath('data.csv')")
  page.evaluate("workRoot={};renderTemplates()")
  assert page.locator('#deleteSelectedTemplates').is_disabled()
  print(entry, ': PASS delete selection, cancel, filtered multi-delete, nested paths, failure retention, workspace isolation')
  assert not errors,errors
  print(entry,': PASS labels, saved file/column refs, click auto-load, relocated paths, duplicate/missing guards, stale read cancellation, legacy 3D')
  page.close()
 b.close()
