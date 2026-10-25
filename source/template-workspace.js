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
const renderTemplateList=renderTemplates;
renderTemplates=function(){renderTemplateList();$('templateList').querySelectorAll('[data-template]').forEach(button=>button.onclick=()=>void openWorkspaceTemplate(templates[+button.dataset.template].data))};
$('templateSearch').oninput=renderTemplates;
renderTemplates();
