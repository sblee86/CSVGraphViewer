"""Requires Python playwright and /usr/bin/chromium; run from any directory."""
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
  result=page.evaluate('''async()=>{
   workspaceDialog.close();
   const csv=[Array.from({length:24},(_,i)=>'column_'+i).join(','),...Array.from({length:220},(_,r)=>Array.from({length:24},(_,c)=>String((r+1)*100000+c)).join(','))].join('\\n');
   load(csv,'wide.csv');
   const main=document.querySelector('main');main.scrollTop=50;
   let before=[window.scrollX,window.scrollY,main.scrollLeft,main.scrollTop,$('left').scrollTop];
   showPreviewHit({source:csvSources[0],localRow:150,columns:[16]});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   function checkCenter(){
    const box=$('table'),outer=box.getBoundingClientRect(),cells=[...box.querySelectorAll('.pickedValue')],rects=cells.map(c=>c.getBoundingClientRect()),header=box.querySelector('thead').getBoundingClientRect().height;
    const dx=(Math.min(...rects.map(r=>r.left))+Math.max(...rects.map(r=>r.right)))/2-(outer.left+box.clientLeft+box.clientWidth/2);
    const dy=(rects[0].top+rects[0].bottom)/2-(outer.top+box.clientTop+header+(box.clientHeight-header)/2);
    if(Math.abs(dx)>2||Math.abs(dy)>2)throw Error('Not centered: '+dx+', '+dy);
   }
   checkCenter();
   if(main.scrollTop!==before[3]||window.scrollY!==before[1])throw Error('Opening preview moved ancestors');
   main.scrollTop=50;before=[window.scrollX,window.scrollY,main.scrollLeft,main.scrollTop,$('left').scrollTop];
   if(main.scrollTop!==50)throw Error('Nonzero ancestor scroll precondition failed');
   if(previewPage!==1)throw Error('Wrong page');
   const strong=$('table').querySelector('.pickedValue strong'),css=getComputedStyle(strong),plain=getComputedStyle($('table').querySelector('td:not(.pickedValue)'));
   if(css.color!=='rgb(229, 57, 53)'||+css.fontWeight<800||parseFloat(css.fontSize)<=parseFloat(plain.fontSize))throw Error('Wrong highlight');
   const selectedRow=strong.closest('tr'),normal=$('table').querySelector('tr:not(.pickedRow) td');
   for(const cell of selectedRow.cells){const style=getComputedStyle(cell);if(+style.fontWeight<700||Math.abs(parseFloat(style.fontSize)-parseFloat(getComputedStyle(normal).fontSize)-4/3)>.03)throw Error('Row highlight incorrect')}
   if(selectedRow.querySelectorAll('.pickedValue').length!==1)throw Error('Red selection spread to row');
   const color=css.color,fontSize=css.fontSize;
   showPreviewHit({source:csvSources[0],localRow:145,columns:[10,11,12]});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));checkCenter();
   for(const row of [100,199]){
    showPreviewHit({source:csvSources[0],localRow:row,columns:[0]});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const box=$('table'),r=box.querySelector('.pickedValue').getBoundingClientRect(),outer=box.getBoundingClientRect();
    if(r.bottom>outer.bottom+1||r.top<outer.top)throw Error('Boundary row invisible');
   }
   const after=[window.scrollX,window.scrollY,main.scrollLeft,main.scrollTop,$('left').scrollTop];
   if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Ancestor moved: '+before+' -> '+after);
   // Exercise the graph pointer-pick route, not just direct preview calls.
   selected=new Set([16]);renderColumns();update();
   const r=seriesRows(16)[50],panel=panels[0],bounds=$('plot').getBoundingClientRect();
   const x=bounds.left+panel.left+(point(r)-panel.xr[0])/(panel.xr[1]-panel.xr[0])*(panel.right-panel.left);
   const y=bounds.top+panel.bottom-(num(r.row[16])-panel.yr[0])/(panel.yr[1]-panel.yr[0])*(panel.bottom-panel.top);
   for(const type of ['pointerdown','pointerup'])$('plot').dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,pointerId:1,clientX:x,clientY:y}));
   return {before,after,color,fontSize};
  }''')
  page.wait_for_function('previewPicked.localRow===50&&previewPicked.columns[0]===16')
  assert not errors,errors
  print(entry,': PASS centering both axes, 100-row pagination, group selection, edge clamping, red/bold/larger text, unchanged ancestor scroll, graph pointer selection',result)
  page.close()
 browser.close()
server.shutdown()
