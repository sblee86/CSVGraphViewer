// Template references are relative to the selected workspace, never its root name.
let workspaceTemplateRequest=0;
function templateFilePaths(v){
 const refs=[v.x,v.y,v.z,v.t,...v.selected,...v.conditions.map(f=>f.axis),...(v.fileX||[]).map(f=>f.axis)];
 return [...new Set([...(v.files||[]),...(v.fileX||[]).map(f=>f.file),...refs.map(r=>r?.file)].filter(p=>typeof p==='string'&&p))];
}
function matchWorkspaceTemplateFile(path){
 const exact=workspaceCsv.find(f=>f.path===path);
 if(exact)return {entry:exact};
 const name=path.split('/').pop(),matches=workspaceCsv.filter(f=>f.path.split('/').pop()===name);
 return matches.length===1?{entry:matches[0]}:{error:matches.length?'ambiguous': 'missing'};
}
async function openWorkspaceTemplate(input){
 const request=++workspaceTemplateRequest,epoch=workspaceEpoch,sequence=multiReadSequence;
 try{
  validateTemplate(input);
  const v=JSON.parse(JSON.stringify(input)),paths=templateFilePaths(v);
  if(!paths.length){applyTemplate(v);return} // Legacy column-only templates still apply to open CSVs.
  if(!workRoot){notice('양식을 자동으로 열려면 작업폴더를 먼저 연결하세요.');return}
  const resolved=new Map(),entries=[],issues=[];
  for(const path of paths){
   const match=matchWorkspaceTemplateFile(path);
   if(match.entry){resolved.set(path,match.entry.path);entries.push(match.entry)}
   else issues.push(path+(match.error==='missing'?' (파일 없음)':' (같은 파일명이 여러 개여서 경로 확인 필요)'));
  }
  // Never silently use stale open data or choose an arbitrary duplicate filename.
  if(issues.length){showMultiWarning('양식 파일을 찾지 못했습니다: '+issues.join(' · '));notice('양식 적용 중단: 작업폴더의 파일을 확인하세요.');return}
  const loaded=await Promise.all([...new Map(entries.map(e=>[e.path,e])).values()].map(async entry=>{
   const file=await entry.handle.getFile(),buffer=await file.arrayBuffer();
   return parseSource(new TextDecoder($('encoding').value).decode(buffer),entry.path,buffer);
  }));
  if(request!==workspaceTemplateRequest||epoch!==workspaceEpoch||sequence!==multiReadSequence)return;
  const remap=ref=>{if(ref&&resolved.has(ref.file))ref.file=resolved.get(ref.file)};
  for(const ref of [v.x,v.y,v.z,v.t,...v.selected,...v.conditions.map(f=>f.axis)])remap(ref);
  for(const f of v.fileX||[]){f.file=resolved.get(f.file)||f.file;remap(f.axis)}
  v.files=paths.map(p=>resolved.get(p));
  multiReadSequence++;templatePending=null;csvSources=loaded;rebuildSources(false);applyTemplate(v);
 }catch(e){if(request===workspaceTemplateRequest&&epoch===workspaceEpoch){showMultiWarning('양식 자동 열기 실패: '+e.message);notice('양식에 필요한 CSV를 읽지 못했습니다.')}}
}
// Selection follows relative template paths, including templates hidden by search.
const checkedTemplatePaths=new Set();
let templateSelectionRoot=null,templateDeleteBusy=false;
const templateActions=document.createElement('div');
templateActions.className='templateActions';
templateActions.innerHTML='<button id="deleteSelectedTemplates" disabled>선택 삭제</button><span id="templateSelectionCount" role="status">0개 선택</span>';
$('templateList').before(templateActions);
function deletableTemplatePath(path){
 if(typeof path!=='string')return false;
 const parts=path.split('/');
 return parts.length>=2&&parts[0]==='양식'&&parts.every(p=>p&&p!=='.'&&p!=='..'&&!p.includes('\\'))&&/\.json$/i.test(parts.at(-1));
}
function updateTemplateSelection(){
 $('deleteSelectedTemplates').disabled=templateDeleteBusy||!checkedTemplatePaths.size||!workRoot;
 $('templateSelectionCount').textContent=checkedTemplatePaths.size+'개 선택';
}
renderTemplates=function(){
 if(templateSelectionRoot!==workRoot){checkedTemplatePaths.clear();templateSelectionRoot=workRoot}
 const existing=new Set(templates.map(t=>t.path));
 for(const path of checkedTemplatePaths)if(!existing.has(path))checkedTemplatePaths.delete(path);
 const q=$('templateSearch').value.toLowerCase();
 $('templateList').innerHTML=templates.map((t,i)=>t.name.toLowerCase().includes(q)?`<div class="templateRow"><input type="checkbox" data-check-template="${i}" aria-label="${esc(t.name)} 삭제 선택" ${checkedTemplatePaths.has(t.path)?'checked':''} ${templateDeleteBusy||!deletableTemplatePath(t.path)?'disabled':''}><button class="templateItem" data-template="${i}"><b>▧ ${esc(t.name)}</b><small>${esc(t.path||'저장한 양식')}</small></button></div>`:'').join('');
 $('templateList').querySelectorAll('[data-template]').forEach(button=>button.onclick=()=>void openWorkspaceTemplate(templates[+button.dataset.template].data));
 $('templateList').querySelectorAll('[data-check-template]').forEach(box=>box.onchange=()=>{const path=templates[+box.dataset.checkTemplate].path;if(box.checked)checkedTemplatePaths.add(path);else checkedTemplatePaths.delete(path);updateTemplateSelection()});
 updateTemplateSelection();
};
async function deleteSelectedTemplates(){
 if(templateDeleteBusy||!workRoot||!checkedTemplatePaths.size)return;
 const root=workRoot,epoch=workspaceEpoch,paths=[...checkedTemplatePaths];
 if(!paths.every(deletableTemplatePath))return notice('작업폴더의 양식 JSON만 삭제할 수 있습니다.');
 if(!confirm('선택한 양식 '+paths.length+'개를 작업폴더에서 삭제할까요?\n'+paths.join('\n')+'\nCSV 원본과 현재 그래프는 유지됩니다.'))return;
 if(root!==workRoot||epoch!==workspaceEpoch)return;
 templateDeleteBusy=true;workspaceTemplateRequest++;renderTemplates();
 let removed=0;const failed=[];
 try{
  for(const path of paths){
   if(root!==workRoot||epoch!==workspaceEpoch)break;
   try{
    const parts=path.split('/'),name=parts.pop();let dir=root;
    for(const part of parts){dir=await dir.getDirectoryHandle(part);if(root!==workRoot||epoch!==workspaceEpoch)break}
    if(root!==workRoot||epoch!==workspaceEpoch)break;
    await dir.removeEntry(name);removed++;
    if(root===workRoot&&epoch===workspaceEpoch)checkedTemplatePaths.delete(path);
   }catch(e){
    if(root!==workRoot||epoch!==workspaceEpoch)break;
    if(e.name==='NotFoundError'){checkedTemplatePaths.delete(path);removed++}
    else failed.push(path+': '+e.message);
   }
  }
  if(root===workRoot&&epoch===workspaceEpoch){await refreshWorkspace();if(root===workRoot&&epoch===workspaceEpoch)notice('양식 삭제 '+removed+'개'+(failed.length?' · 실패 '+failed.length+'개: '+failed.join(' · '):''))}
 }finally{templateDeleteBusy=false;renderTemplates()}
}
$('deleteSelectedTemplates').onclick=()=>void deleteSelectedTemplates();
$('templateSearch').oninput=renderTemplates;
renderTemplates();

// Start a fresh analysis without changing the CSV files or saved templates.
const clearTemplateButton=document.createElement('button');clearTemplateButton.id='clearCurrentTemplate';clearTemplateButton.textContent='양식 해제';clearTemplateButton.className='sidebarAction';
const templateState=document.createElement('p');templateState.id='currentTemplateState';templateState.setAttribute('role','status');
$('saveTemplate').after(clearTemplateButton,templateState);
function updateCurrentTemplateState(){templateState.textContent=templatePending?'현재 양식: '+templatePending.name:'양식 미적용'}
const applyTemplateBeforeStatus=applyTemplate;
applyTemplate=function(v){applyTemplateBeforeStatus(v);updateCurrentTemplateState()};
const renderTemplatesBeforeStatus=renderTemplates;
renderTemplates=function(){renderTemplatesBeforeStatus();updateCurrentTemplateState()};
$('templateSearch').oninput=renderTemplates;
clearTemplateButton.onclick=()=>{
 workspaceTemplateRequest++;multiReadSequence++;stopPlayback();templatePending=null;$('templateName').value='';
 for(const [id,value] of [['dimension','2d'],['layout','overlay'],['style','line'],['selection','multi'],['timeMode','all']])$(id).value=value;
 angleYaw=.65;anglePitch=.45;scale3=1;offset3=[0,0];$('timeSlider').value=0;
 for(const id of ['xmin','xmax','ymin','ymax','applybounds'])$(id).disabled=false;
 for(const source of csvSources){source.x=source.numeric.indexOf(true);previewTableStates.delete(source)}
 previewPicked=null;rebuildSources(false);showMultiWarning('');checkedTemplatePaths.clear();renderTemplates();notice('양식을 해제하고 기본 그래프 설정으로 돌아왔습니다.');
};
for(const id of ['openTemplates','openFolder','workspaceChange','workspaceRefresh'])$(id).classList.add('sidebarAction');
updateCurrentTemplateState();
