// Preview uses source record identities, not combined/filtered row indexes.
// Paging keeps every row reachable without adding thousands of DOM nodes.
const dataPreview=document.querySelector('.preview'),previewSummary=dataPreview.querySelector('summary');
previewSummary.innerHTML='데이터 미리보기 <span>파일별 전체 데이터</span>';
const previewTools=document.createElement('div');previewTools.className='previewTools';previewTools.innerHTML='<label>파일 <select id="previewSource" aria-label="미리보기 파일"></select></label><button id="previewPrev">이전</button><span id="previewPageInfo"></span><button id="previewNext">다음</button><label>데이터 행 <input id="previewRowJump" type="number" min="1" step="1" placeholder="행 번호"></label><button id="previewGo">보기</button>';
const previewSelection=document.createElement('div');previewSelection.id='previewSelection';previewSelection.setAttribute('role','status');previewSelection.textContent='그래프의 데이터 점을 클릭하면 해당 행과 필드를 표시합니다.';
const previewClear=document.createElement('button');previewClear.id='previewClearTable';previewClear.textContent='표 필터·정렬 초기화';previewClear.onclick=()=>{if(previewSource)previewTableStates.delete(previewSource);previewPage=0;window.renderDataPreview();$('table').scrollTop=0};previewTools.append(previewClear);
$('table').before(previewTools,previewSelection);
let previewSource=null,previewPage=0,previewPicked=null;
const previewPageSize=100;
function validPreviewPick(pick){return !!pick&&csvSources.includes(pick.source)&&Number.isInteger(pick.localRow)&&pick.localRow>=0&&pick.localRow<pick.source.data.length}
function previewCellHTML(source,localRow,col){const value=esc(source.data[localRow][col]),picked=validPreviewPick(previewPicked)&&previewPicked.source===source&&previewPicked.localRow===localRow&&previewPicked.columns.includes(col);return `<td data-preview-col="${col}"${picked?' class="pickedValue" aria-label="선택한 값"':''}>${picked?'<strong>'+value+'</strong>':value}</td>`}
window.renderDataPreview=function(revealPick=false){
 closePreviewFilter();
 if(!csvSources.includes(previewSource)){previewSource=csvSources[0]||null;previewPage=0}if(!validPreviewPick(previewPicked))previewPicked=null;
 $('previewSource').innerHTML=csvSources.map((s,i)=>`<option value="${i}">${esc(sourceLabel(s))}</option>`).join('');$('previewSource').value=String(csvSources.indexOf(previewSource));$('previewSource').disabled=!csvSources.length;
 const tableRows=previewTableRows(previewSource),count=tableRows.length,pages=Math.max(1,Math.ceil(count/previewPageSize));previewPage=Math.max(0,Math.min(previewPage,pages-1));const first=previewPage*previewPageSize,last=Math.min(count,first+previewPageSize);
 $('previewPageInfo').textContent=count?`${first+1}–${last} / ${count.toLocaleString()}행 · ${previewPage+1}/${pages}쪽`:'데이터 없음';if(previewSource)$('previewPageInfo').textContent+=` · 원본 ${previewSource.data.length.toLocaleString()}행`;$('previewPrev').disabled=previewPage===0;$('previewNext').disabled=previewPage>=pages-1;$('previewRowJump').max=String(previewSource?.data.length||0);$('previewRowJump').disabled=!previewSource?.data.length;$('previewGo').disabled=!previewSource?.data.length;
 if(!previewSource){$('table').innerHTML='';previewSelection.textContent='그래프의 데이터 점을 클릭하면 해당 행과 필드를 표시합니다.';return}
 $('table').innerHTML='<table><thead><tr><th>데이터 행</th>'+previewSource.head.map((_,col)=>previewHeaderHTML(previewSource,col)).join('')+'</tr></thead><tbody>'+tableRows.slice(first,last).map(localRow=>{return `<tr data-preview-row="${localRow}"><td>${localRow+1}</td>`+previewSource.head.map((_,col)=>previewCellHTML(previewSource,localRow,col)).join('')+'</tr>'}).join('')+'</tbody></table>';
 $('table').querySelectorAll('[data-preview-filter]').forEach(button=>button.onclick=()=>openPreviewFilter(+button.dataset.previewFilter,button));
 previewSelection.textContent=previewPicked?`선택: ${sourceLabel(previewPicked.source)} · 데이터 ${previewPicked.localRow+1}행 · ${previewPicked.columns.map(i=>previewPicked.source.head[i]).join(', ')} (선택 값: 빨간색·굵게·확대)`:'그래프의 데이터 점을 클릭하면 해당 행과 필드를 표시합니다. 행 번호는 제목 행을 제외한 데이터 순서입니다.';
 // Wait for the details panel to finish opening before measuring its cells.
 if(revealPick&&previewPicked&&previewPicked.source===previewSource){const pick=previewPicked;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(previewPicked!==pick||previewSource!==pick.source||!dataPreview.open)return;const cells=[...$('table').querySelectorAll('.pickedValue')];if(cells.length){const box=$('table'),outer=box.getBoundingClientRect(),rects=cells.map(cell=>cell.getBoundingClientRect()),header=box.querySelector('thead').getBoundingClientRect().height;
 // Center the selected cells inside the table viewport, excluding its sticky header.
 // Only mutate this scroll container: never focus or scroll any ancestor.
 const centerX=(Math.min(...rects.map(r=>r.left))+Math.max(...rects.map(r=>r.right)))/2;
 const centerY=(rects[0].top+rects[0].bottom)/2;
 box.scrollTop+=centerY-(outer.top+box.clientTop+header+(box.clientHeight-header)/2);
 box.scrollLeft+=centerX-(outer.left+box.clientLeft+box.clientWidth/2);
 }}))}
};
function showPreviewHit(hit){if(!validPreviewPick(hit))return;previewPicked=hit;previewSource=hit.source;const state=previewTableState(previewSource);let cleared=false;for(const [col,values] of state.filters)if(!values.has(previewSource.data[hit.localRow][col])){state.filters.delete(col);cleared=true}previewPage=Math.floor(previewTableRows(previewSource).indexOf(hit.localRow)/previewPageSize);if(cleared)notice('선택한 그래프 데이터를 표시하도록 해당 열의 표 필터를 해제했습니다.');dataPreview.open=true;window.renderDataPreview(true)}
$('previewSource').onchange=()=>{previewSource=csvSources[+$('previewSource').value]||null;previewPage=0;window.renderDataPreview();$('table').scrollTop=0};
$('previewPrev').onclick=()=>{previewPage--;window.renderDataPreview();$('table').scrollTop=0};$('previewNext').onclick=()=>{previewPage++;window.renderDataPreview();$('table').scrollTop=0};
function jumpPreviewRow(){const value=$('previewRowJump').value,n=Number(value);if(!previewSource||!value||!Number.isInteger(n)||n<1||n>previewSource.data.length)return notice('파일의 데이터 행 번호를 입력하세요.');const index=previewTableRows(previewSource).indexOf(n-1);if(index<0)return notice('해당 행은 표 필터에서 제외되어 있습니다. 필터를 해제하세요.');previewPage=Math.floor(index/previewPageSize);window.renderDataPreview();const row=$('table').querySelector(`[data-preview-row="${n-1}"]`);if(row)$('table').scrollTop=Math.max(0,row.offsetTop-40)}
$('previewGo').onclick=jumpPreviewRow;$('previewRowJump').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();jumpPreviewRow()}};
function previewVisibleRows(){return $('timeMode').value==='trail'?ordered().slice(0,+$('timeSlider').value+1).map(o=>o.r):filtered}
function nearest2DPreviewHit(c){const p=panelAt(c);if(!p)return null;let best=null,distance=18*18;const visible=previewVisibleRows();for(const col of p.series){const meta=columnMeta[col];if(!meta)continue;for(const r of visible){if(r.row._source!==meta.source)continue;const x=point(r),y=num(r.row[col]);if(!Number.isFinite(x)||!Number.isFinite(y)||x<p.xr[0]||x>p.xr[1]||y<p.yr[0]||y>p.yr[1])continue;const px=p.left+(x-p.xr[0])/(p.xr[1]-p.xr[0])*(p.right-p.left),py=p.bottom-(y-p.yr[0])/(p.yr[1]-p.yr[0])*(p.bottom-p.top),d=(px-c.x)**2+(py-c.y)**2;if(d<distance){distance=d;best={source:csvSources[meta.source],localRow:r.row._localIndex,columns:[meta.local]}}}}return best}
function nearest3DPreviewHit(c){const ids=[+$('x').value,+$('yaxis3').value,+$('zaxis').value],list=ordered(),full=list.map(o=>({r:o.r,v:ids.map(i=>i===-1?o.r.index+1:num(o.r.row[i]))})),ranges=ids.map((_,i)=>extent(full.map(p=>p.v[i])));const shown=$('timeMode').value==='all'?full:full.slice(0,+$('timeSlider').value+1);let best=null,distance=18*18;for(const p of shown){if(!p.v.every(Number.isFinite))continue;const normalized=p.v.map((v,i)=>(v-ranges[i][0])/(ranges[i][1]-ranges[i][0])*2-1),[x,y]=project3(...normalized,$('plot').clientWidth,$('plot').clientHeight);if(x<0||y<0||x>$('plot').clientWidth||y>$('plot').clientHeight)continue;const d=(x-c.x)**2+(y-c.y)**2;if(d<distance){const source=csvSources[p.r.row._source],columns=[...new Set(ids.filter(i=>i>=0&&columnMeta[i]?.source===p.r.row._source).map(i=>columnMeta[i].local))];if(!columns.length)continue;distance=d;best={source,localRow:p.r.row._localIndex,columns}}}return best}
// Observe before the existing zoom/pan and 3D rotation handlers. A drag, middle
// button, cancelled pointer or right-click must never change the selected row.
let previewGesture=null;
$('plotwrap').addEventListener('pointerdown',e=>{if(e.target!==$('plot')||e.button!==0)return;previewGesture={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false}},true);
$('plotwrap').addEventListener('pointermove',e=>{if(previewGesture?.id===e.pointerId&&Math.hypot(e.clientX-previewGesture.x,e.clientY-previewGesture.y)>4)previewGesture.moved=true},true);
$('plotwrap').addEventListener('pointerup',e=>{const g=previewGesture;if(!g||g.id!==e.pointerId)return;previewGesture=null;if(e.button!==0||g.moved||Math.hypot(e.clientX-g.x,e.clientY-g.y)>4)return;const c=coords(e),hit=$('dimension').value==='3d'?nearest3DPreviewHit(c):nearest2DPreviewHit(c);if(hit)queueMicrotask(()=>showPreviewHit(hit))},true);
$('plotwrap').addEventListener('pointercancel',()=>{previewGesture=null},true);
$('plotwrap').addEventListener('lostpointercapture',()=>{previewGesture=null},true);
window.renderDataPreview();
