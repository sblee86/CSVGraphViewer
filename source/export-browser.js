// Only files directly inside the selected workspace's export directory are managed.
const exportBrowser=document.createElement('dialog');exportBrowser.id='exportBrowser';exportBrowser.setAttribute('aria-labelledby','exportBrowserTitle');
exportBrowser.innerHTML=`<div class="exportBrowserHeading"><h2 id="exportBrowserTitle">저장 파일 전체보기</h2><button id="exportBrowserClose">닫기 ×</button></div><div class="exportBrowserTabs" role="tablist" aria-label="저장 파일 종류"><button id="exportTabPng" role="tab" aria-controls="exportFilePanel">PNG 이미지</button><button id="exportTabCsv" role="tab" aria-controls="exportFilePanel">CSV 데이터</button></div><section id="exportFilePanel" role="tabpanel"><div class="exportBrowserActions"><label><input id="exportCheckAll" type="checkbox">전체 선택</label><button id="exportBrowserRefresh">목록 새로고침</button><button id="exportDeleteChecked" disabled>선택 삭제</button><span id="exportCheckedCount" role="status"></span></div><p id="exportBrowserStatus" role="status"></p><div id="exportBrowserFiles"></div></section><section class="exportPreview"><div class="exportPreviewHeading"><h3 id="exportPreviewTitle">파일 미리보기</h3><a id="exportOpenFile" hidden target="_blank" rel="noopener">파일 열기 ↗</a></div><div id="exportPreviewContent">파일명을 누르면 여기에 표시합니다.</div><div id="exportCsvPages" hidden><button id="exportCsvPrev">이전</button><span id="exportCsvPageInfo"></span><button id="exportCsvNext">다음</button></div></section>`;
document.body.append(exportBrowser);
let exportBrowserRoot=null,exportBrowserEpoch=0,exportBrowserTab='png',exportBrowserFiles=[],exportBrowserDir=null,exportBrowserRequest=0,exportPreviewRequest=0,exportPreviewUrl=null,exportPreviewName=null,exportCsvData=null,exportCsvPage=0,exportDeleteBusy=false;
const exportBrowserChecked=new Set();
function validExportFile(name){return typeof name==='string'&&!/[\\/]/.test(name)&&/\.(png|csv)$/i.test(name)}
function exportBrowserCurrent(){return exportBrowser.open&&workRoot===exportBrowserRoot&&workspaceEpoch===exportBrowserEpoch}
function clearExportPreview(){exportPreviewRequest++;if(exportPreviewUrl)URL.revokeObjectURL(exportPreviewUrl);exportPreviewUrl=null;exportPreviewName=null;exportCsvData=null;$('exportOpenFile').hidden=true;$('exportOpenFile').removeAttribute('href');$('exportCsvPages').hidden=true;$('exportPreviewTitle').textContent='파일 미리보기';$('exportPreviewContent').textContent='파일명을 누르면 여기에 표시합니다.'}
function currentExportBrowserFiles(){return exportBrowserFiles.filter(f=>f.name.toLowerCase().endsWith('.'+exportBrowserTab))}
function updateExportBrowserChecks(){const list=currentExportBrowserFiles(),count=list.filter(f=>exportBrowserChecked.has(f.name)).length;$('exportCheckedCount').textContent=count+'개 선택';$('exportDeleteChecked').disabled=exportDeleteBusy||!count;$('exportCheckAll').disabled=exportDeleteBusy||!list.length;$('exportCheckAll').checked=list.length>0&&count===list.length;$('exportCheckAll').indeterminate=count>0&&count<list.length}
function renderExportBrowser(){
 const list=currentExportBrowserFiles();
 for(const type of ['png','csv']){const button=$(type==='png'?'exportTabPng':'exportTabCsv'),active=type===exportBrowserTab;button.classList.toggle('on',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1}
 $('exportFilePanel').setAttribute('aria-labelledby',exportBrowserTab==='png'?'exportTabPng':'exportTabCsv');
 $('exportBrowserFiles').innerHTML=list.map(f=>`<div class="exportFileRow"><input type="checkbox" data-export-check="${esc(f.name)}" aria-label="${esc(f.name)} 삭제 선택" ${exportBrowserChecked.has(f.name)?'checked':''} ${exportDeleteBusy?'disabled':''}><button data-export-file="${esc(f.name)}" ${exportPreviewName===f.name?'class="on"':''}>${esc(f.name)}</button></div>`).join('')||'<p>저장된 '+exportBrowserTab.toUpperCase()+' 파일이 없습니다.</p>';
 $('exportBrowserFiles').querySelectorAll('[data-export-check]').forEach(box=>box.onchange=()=>{if(box.checked)exportBrowserChecked.add(box.dataset.exportCheck);else exportBrowserChecked.delete(box.dataset.exportCheck);updateExportBrowserChecks()});
 $('exportBrowserFiles').querySelectorAll('[data-export-file]').forEach(button=>button.onclick=()=>void previewExportFile(button.dataset.exportFile));updateExportBrowserChecks();
}
async function refreshExportBrowser(){
 const request=++exportBrowserRequest;if(!exportBrowserCurrent())return;
 $('exportBrowserStatus').textContent='저장 파일을 읽는 중…';
 try{
  await exportWriteQueue;if(request!==exportBrowserRequest||!exportBrowserCurrent())return;
  let dir;try{dir=await exportBrowserRoot.getDirectoryHandle('내보내기')}catch(e){if(e.name!=='NotFoundError')throw e}
  const files=[];if(dir)for await(const [name,handle] of dir.entries())if(handle.kind==='file'&&validExportFile(name))files.push({name,handle});
  if(request!==exportBrowserRequest||!exportBrowserCurrent())return;
  exportBrowserDir=dir;exportBrowserFiles=files.sort((a,b)=>b.name.localeCompare(a.name,'ko',{numeric:true}));
  const names=new Set(files.map(f=>f.name));for(const name of exportBrowserChecked)if(!names.has(name))exportBrowserChecked.delete(name);
  if(exportPreviewName&&!names.has(exportPreviewName))clearExportPreview();
  $('exportBrowserStatus').textContent=exportBrowserRoot.name+'/내보내기/ · '+files.length+'개';renderExportBrowser();
 }catch(e){if(request===exportBrowserRequest&&exportBrowserCurrent()){$('exportBrowserStatus').textContent='목록 읽기 실패: '+e.message;exportBrowserFiles=[];exportBrowserDir=null;clearExportPreview();renderExportBrowser()}}
}
function renderExportCsv(){
 const data=exportCsvData||[],header=data[0]||[],count=Math.max(0,data.length-1),pages=Math.max(1,Math.ceil(count/100));exportCsvPage=Math.max(0,Math.min(exportCsvPage,pages-1));const start=exportCsvPage*100;
 $('exportPreviewContent').innerHTML='<div class="exportCsvTable"><table><thead><tr><th>데이터 행</th>'+header.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+data.slice(start+1,start+101).map((row,i)=>'<tr><td>'+(start+i+1)+'</td>'+row.map(value=>'<td>'+esc(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 $('exportCsvPages').hidden=false;$('exportCsvPageInfo').textContent=`${count?start+1:0}–${Math.min(count,start+100)} / ${count}행 · ${exportCsvPage+1}/${pages}쪽`;$('exportCsvPrev').disabled=exportCsvPage===0;$('exportCsvNext').disabled=exportCsvPage>=pages-1;
}
async function previewExportFile(name){
 const entry=exportBrowserFiles.find(f=>f.name===name);if(!entry||!exportBrowserCurrent())return;
 clearExportPreview();const request=exportPreviewRequest;exportPreviewName=name;$('exportPreviewTitle').textContent=name;$('exportPreviewContent').textContent='파일을 여는 중…';renderExportBrowser();
 try{
  const file=await entry.handle.getFile();if(request!==exportPreviewRequest||!exportBrowserCurrent())return;
  if(/\.csv$/i.test(name)){const text=await file.text();if(request!==exportPreviewRequest||!exportBrowserCurrent())return;exportCsvData=parseCSV(text,'auto');exportCsvPage=0;renderExportCsv()}
  else{const image=document.createElement('img');image.alt=name;image.onerror=()=>{if(request===exportPreviewRequest)$('exportPreviewContent').textContent='이미지를 읽을 수 없습니다.'};exportPreviewUrl=URL.createObjectURL(new Blob([file],{type:'image/png'}));image.src=exportPreviewUrl;$('exportPreviewContent').replaceChildren(image)}
  if(!exportPreviewUrl)exportPreviewUrl=URL.createObjectURL(new Blob([file],{type:'text/csv;charset=utf-8'}));$('exportOpenFile').href=exportPreviewUrl;$('exportOpenFile').hidden=false;
 }catch(e){if(request===exportPreviewRequest&&exportBrowserCurrent())$('exportPreviewContent').textContent='파일 열기 실패: '+e.message}
}
async function deleteCheckedExports(){
 if(exportDeleteBusy||!exportBrowserCurrent()||!exportBrowserDir)return;
 const names=currentExportBrowserFiles().filter(f=>exportBrowserChecked.has(f.name)).map(f=>f.name);if(!names.length)return;
 if(!confirm('선택한 저장 파일 '+names.length+'개를 내보내기 폴더에서 삭제할까요?\n'+names.join('\n')))return;
 if(!exportBrowserCurrent())return;
 const root=exportBrowserRoot,epoch=exportBrowserEpoch,dir=exportBrowserDir;exportDeleteBusy=true;renderExportBrowser();let removed=0;const failed=[];
 try{for(const name of names){if(!exportBrowserCurrent()||root!==exportBrowserRoot||epoch!==exportBrowserEpoch)break;
  try{await dir.removeEntry(name);removed++}catch(e){if(e.name==='NotFoundError')removed++;else{failed.push(name+': '+e.message);continue}}
  if(!exportBrowserCurrent()||root!==exportBrowserRoot||epoch!==exportBrowserEpoch)break;
  exportBrowserChecked.delete(name);if(exportPreviewName===name)clearExportPreview();
 }
 if(exportBrowserCurrent()&&root===exportBrowserRoot&&epoch===exportBrowserEpoch){await refreshExportBrowser();if(exportBrowserCurrent())$('exportBrowserStatus').textContent='삭제 '+removed+'개'+(failed.length?' · 실패 '+failed.length+'개: '+failed.join(' · '):'')}
 }finally{exportDeleteBusy=false;renderExportBrowser()}
}
function setExportBrowserTab(type){exportBrowserTab=type;clearExportPreview();renderExportBrowser()}
$('exportTabPng').onclick=()=>setExportBrowserTab('png');$('exportTabCsv').onclick=()=>setExportBrowserTab('csv');
exportBrowser.querySelector('[role="tablist"]').onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setExportBrowserTab(e.key==='Home'?'png':e.key==='End'?'csv':exportBrowserTab==='png'?'csv':'png');$(exportBrowserTab==='png'?'exportTabPng':'exportTabCsv').focus()}};
$('exportCheckAll').onchange=()=>{for(const file of currentExportBrowserFiles())if($('exportCheckAll').checked)exportBrowserChecked.add(file.name);else exportBrowserChecked.delete(file.name);renderExportBrowser()};
$('exportDeleteChecked').onclick=()=>void deleteCheckedExports();$('exportBrowserRefresh').onclick=()=>void refreshExportBrowser();$('exportBrowserClose').onclick=()=>exportBrowser.close();
$('exportCsvPrev').onclick=()=>{exportCsvPage--;renderExportCsv()};$('exportCsvNext').onclick=()=>{exportCsvPage++;renderExportCsv()};
exportBrowser.addEventListener('close',()=>{exportBrowserRequest++;clearExportPreview()});
$('reset').onclick=()=>{if(!workRoot)return notice('작업폴더를 먼저 연결하세요.');exportBrowserRoot=workRoot;exportBrowserEpoch=workspaceEpoch;exportBrowserFiles=[];exportBrowserDir=null;exportBrowserChecked.clear();exportBrowserTab='png';clearExportPreview();renderExportBrowser();exportBrowser.showModal();void refreshExportBrowser()};
$('reset').title='내보내기 폴더의 PNG·CSV 저장 파일 목록과 미리보기를 엽니다.';
