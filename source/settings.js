// Settings are applied immediately and saved only after pressing Save.
const viewerDefaults={uiSize:13,graphSettingsSize:13,summarySize:100,axisSize:11,iconSize:25,rowHeight:36,lineWidth:1.6,pointSize:2.1,theme:'light',grid:true,compact:true,outerMargin:4};
function normalizePrefs(p){const number=(k,min,max)=>{let n=Number(p[k]);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):viewerDefaults[k]};return {uiSize:number('uiSize',8,40),graphSettingsSize:number('graphSettingsSize',8,40),summarySize:number('summarySize',50,150),axisSize:number('axisSize',8,40),iconSize:number('iconSize',12,64),rowHeight:number('rowHeight',20,80),lineWidth:number('lineWidth',.5,8),pointSize:number('pointSize',1,12),theme:p.theme==='dark'?'dark':'light',grid:p.grid!==false,compact:p.compact!==false,outerMargin:number('outerMargin',0,24)}}
viewerPrefs=normalizePrefs(viewerPrefs);
const settingsDialog=document.createElement('dialog');settingsDialog.id='viewerSettings';
settingsDialog.innerHTML=`<h2>⚙ CSVtoGraphViewer 설정</h2><div class="settingsRows">
<label>화면 글자 크기 (8–40 px)<input id="pref-uiSize" type="number" min="8" max="40" step="0.5"></label>
<label>그래프설정 메뉴 글자 크기 (8–40 px)<input id="pref-graphSettingsSize" type="number" min="8" max="40" step="0.5"></label>
<label>그래프 요약·조작줄 크기 (50–150 %)<input id="pref-summarySize" type="number" min="50" max="150" step="5"></label>
<label>그래프 축 글자 크기 (8–40 px)<input id="pref-axisSize" type="number" min="8" max="40" step="0.5"></label>
<label>아이콘 크기 (12–64 px)<input id="pref-iconSize" type="number" min="12" max="64" step="1"></label>
<label>목록·표 줄 높이 (20–80 px)<input id="pref-rowHeight" type="number" min="20" max="80" step="1"></label>
<label>테마<select id="pref-theme"><option value="light">밝게 · 민트</option><option value="dark">어둡게 · 민트</option></select></label>
<label>그래프 선 두께 (0.5–8 px)<input id="pref-lineWidth" type="number" min="0.5" max="8" step="0.1"></label>
<label>그래프 점 크기 (1–12 px)<input id="pref-pointSize" type="number" min="1" max="12" step="0.1"></label>
<label>격자 표시<select id="pref-grid"><option value="true">표시</option><option value="false">숨김</option></select></label>
<label>창 바깥 여백 (0–24 px)<input id="pref-outerMargin" type="number" min="0" max="24" step="1"></label>
<label>화면 여백<select id="pref-compact"><option value="false">기본</option><option value="true">좁게</option></select></label></div>
<p class="settingsNote">글자 크기는 숫자로 직접 입력할 수 있습니다. 변경 결과는 즉시 미리보기에 반영됩니다. 저장한 설정은 같은 브라우저와 파일 위치에서 다음 실행에도 적용됩니다.</p>
<div class="settingsActions"><button id="prefsDefault">기본값</button><button id="prefsCancel">취소</button><button id="prefsSave" class="solid" style="width:auto;margin:0">저장 및 닫기</button></div>`;
document.body.append(settingsDialog);
let prefsBefore=null;
function applyViewerPrefs(){document.body.style.setProperty('--summary-scale',viewerPrefs.summarySize/100);document.body.style.setProperty('--ui-scale',viewerPrefs.uiSize/13);document.body.style.setProperty('--graph-settings-size',viewerPrefs.graphSettingsSize+'px');document.body.style.setProperty('--icon-size',viewerPrefs.iconSize+'px');document.body.style.setProperty('--row-height',viewerPrefs.rowHeight+'px');document.body.style.setProperty('--row-pad',Math.max(2,(viewerPrefs.rowHeight-20)/2)+'px');document.body.classList.toggle('dark',viewerPrefs.theme==='dark');document.body.classList.toggle('compact',viewerPrefs.compact);document.body.style.setProperty('--outer-margin',viewerPrefs.outerMargin+'px');draw()}
function fillPrefs(){for(const k of Object.keys(viewerDefaults))$('pref-'+k).value=String(viewerPrefs[k])}
function saveViewerPrefs(){try{localStorage.setItem('CSVtoGraphViewer-settings',JSON.stringify(viewerPrefs));localStorage.setItem('scope-dark',String(viewerPrefs.theme==='dark'));return true}catch{notice('설정을 저장할 수 없습니다. 현재 실행에만 적용됩니다.');return false}}
$('settingsOpen').onclick=()=>{prefsBefore={...viewerPrefs};fillPrefs();settingsDialog.showModal()};
for(const k of Object.keys(viewerDefaults))$('pref-'+k).addEventListener('input',()=>{const el=$('pref-'+k);if(el.type==='number'&&!el.validity.valid)return;viewerPrefs=normalizePrefs({...viewerPrefs,[k]:k==='grid'||k==='compact'?el.value==='true':el.value});applyViewerPrefs()});
$('prefsDefault').onclick=()=>{viewerPrefs={...viewerDefaults};fillPrefs();applyViewerPrefs()};
function cancelPrefs(){if(prefsBefore){viewerPrefs={...prefsBefore};applyViewerPrefs()}settingsDialog.close()}
$('prefsCancel').onclick=cancelPrefs;settingsDialog.addEventListener('cancel',e=>{e.preventDefault();cancelPrefs()});
$('prefsSave').onclick=()=>{if(![...settingsDialog.querySelectorAll('input')].every(el=>el.reportValidity()))return;viewerPrefs=normalizePrefs(viewerPrefs);saveViewerPrefs();prefsBefore=null;settingsDialog.close()};
$('theme').onclick=()=>{viewerPrefs.theme=viewerPrefs.theme==='dark'?'light':'dark';applyViewerPrefs();saveViewerPrefs()};
applyViewerPrefs();

// Separate icon glyphs from button labels so changing text size does not resize icons.
for(const button of document.querySelectorAll('.app button')){
 const first=button.firstChild;
 if(first?.nodeType===Node.TEXT_NODE){const match=first.textContent.match(/^([▤∿⊞▧↓⚙◐⌕✥＋▶❚❚📂📁💾]+)\s*/u);if(match){const icon=document.createElement('span');icon.className='ui-icon';icon.setAttribute('aria-hidden','true');icon.textContent=match[1];first.textContent=first.textContent.slice(match[0].length);button.insertBefore(icon,first)}}
}
