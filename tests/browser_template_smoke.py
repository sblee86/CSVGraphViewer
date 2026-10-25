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
  assert not errors,errors
  print(entry,': PASS labels, saved file/column refs, click auto-load, relocated paths, duplicate/missing guards, stale read cancellation, legacy 3D')
  page.close()
 b.close()
