// Preview filters/sorting never mutate CSV records or the graph's range filters.
const previewTableStates=new WeakMap();
function previewTableState(source){let state=previewTableStates.get(source);if(!state){state={filters:new Map(),sort:null};previewTableStates.set(source,state)}return state}
function previewTableRows(source){
 if(!source)return [];
 const state=previewTableState(source),ids=source.data.map((_,i)=>i).filter(i=>[...state.filters].every(([col,values])=>values.has(source.data[i][col])));
 if(state.sort){const {col,direction}=state.sort;ids.sort((a,b)=>{const x=source.data[a][col],y=source.data[b][col];if(x===''||y==='')return x===y?a-b:x===''?1:-1;const nx=num(x),ny=num(y),order=Number.isFinite(nx)&&Number.isFinite(ny)?nx-ny:x.localeCompare(y,'ko',{numeric:true});return order*direction||a-b})}
 return ids;
}
function previewHeaderHTML(source,col){const state=previewTableState(source),active=state.filters.has(col),sort=state.sort?.col===col?state.sort.direction:0;return `<th${sort?' aria-sort="'+(sort===1?'ascending':'descending')+'"':''}><span>${esc(source.head[col])}</span><button class="previewFilterButton${active?' active':''}" data-preview-filter="${col}" aria-label="${esc(source.head[col])} 필터 및 정렬" aria-haspopup="dialog">${sort===1?'↑':sort===-1?'↓':''}${active?'●':'▾'}</button></th>`}
const previewFilterMenu=document.createElement('div');previewFilterMenu.id='previewFilterMenu';previewFilterMenu.hidden=true;previewFilterMenu.setAttribute('role','dialog');previewFilterMenu.setAttribute('aria-label','열 값 필터 및 정렬');document.body.append(previewFilterMenu);
let previewFilterEditor=null;
function closePreviewFilter(returnFocus=false){const button=previewFilterEditor?.button;previewFilterMenu.hidden=true;previewFilterEditor=null;if(returnFocus&&button?.isConnected)button.focus({preventScroll:true})}
function renderPreviewFilterValues(){
 const editor=previewFilterEditor;if(!editor)return;
 const q=$('previewValueSearch').value.toLocaleLowerCase();editor.matches=editor.values.filter(([value])=>value.toLocaleLowerCase().includes(q));editor.shown=200;paintPreviewFilterValues();
}
function paintPreviewFilterValues(){
 const e=previewFilterEditor;if(!e)return;
 $('previewValueList').innerHTML=e.matches.slice(0,e.shown).map(([value,count])=>{const index=e.indices.get(value);return `<label><input type="checkbox" data-preview-value="${index}" ${e.checked.has(value)?'checked':''}><span>${esc(value===''?'(빈 셀)':value)}</span><small>${count}개</small></label>`}).join('')||'<p>검색 결과 없음</p>';
 $('previewValueList').querySelectorAll('input').forEach(box=>box.onchange=()=>{const value=e.values[+box.dataset.previewValue][0];if(box.checked)e.checked.add(value);else e.checked.delete(value);updatePreviewFilterCount()});
 $('previewMoreValues').hidden=e.shown>=e.matches.length;updatePreviewFilterCount();
}
function updatePreviewFilterCount(){const e=previewFilterEditor;$('previewValueCount').textContent=`고유값 ${e.values.length.toLocaleString()}개 · 선택 ${e.checked.size.toLocaleString()}개 · 검색 ${e.matches.length.toLocaleString()}개`;const all=$('previewSelectAll'),n=e.matches.filter(([v])=>e.checked.has(v)).length;all.checked=e.matches.length>0&&n===e.matches.length;all.indeterminate=n>0&&n<e.matches.length;all.disabled=!e.matches.length}
function openPreviewFilter(col,button){
 closePreviewFilter();const source=previewSource;if(!source)return;
 const state=previewTableState(source),counts=new Map();for(const row of source.data)counts.set(row[col],(counts.get(row[col])||0)+1);
 const values=[...counts].sort((a,b)=>a[0].localeCompare(b[0],'ko',{numeric:true}));
 previewFilterEditor={source,col,button,values,indices:new Map(values.map(([v],i)=>[v,i])),checked:new Set(state.filters.get(col)||counts.keys()),matches:values,shown:200};
 previewFilterMenu.innerHTML=`<b>${esc(source.head[col])}</b><div class="previewSortActions"><button id="previewSortAsc">↑ 오름차순</button><button id="previewSortDesc">↓ 내림차순</button><button id="previewSortClear">정렬 해제</button></div><input id="previewValueSearch" placeholder="값 검색" aria-label="열 값 검색"><label class="previewSelectAll"><input type="checkbox" id="previewSelectAll">검색 값 전체 선택 / 해제</label><div id="previewValueCount" role="status"></div><div id="previewValueList"></div><button id="previewMoreValues">값 더 보기</button><div class="previewFilterActions"><button id="previewFilterClear">이 열 필터 해제</button><button id="previewFilterCancel">취소</button><button id="previewFilterApply">적용</button></div>`;
 for(const [id,direction] of [['previewSortAsc',1],['previewSortDesc',-1],['previewSortClear',0]])$(id).onclick=()=>{state.sort=direction?{col,direction}:null;closePreviewFilter();previewPage=0;window.renderDataPreview();$('table').scrollTop=0};
 $('previewValueSearch').oninput=renderPreviewFilterValues;
 $('previewSelectAll').onchange=()=>{const e=previewFilterEditor;for(const [value] of e.matches)if($('previewSelectAll').checked)e.checked.add(value);else e.checked.delete(value);paintPreviewFilterValues()};
 $('previewMoreValues').onclick=()=>{previewFilterEditor.shown+=200;paintPreviewFilterValues()};
 $('previewFilterCancel').onclick=()=>closePreviewFilter(true);
 $('previewFilterClear').onclick=()=>{state.filters.delete(col);closePreviewFilter();previewPage=0;window.renderDataPreview();$('table').scrollTop=0};
 $('previewFilterApply').onclick=()=>{const e=previewFilterEditor;if(e.checked.size===e.values.length)state.filters.delete(col);else state.filters.set(col,new Set(e.checked));closePreviewFilter();previewPage=0;window.renderDataPreview();$('table').scrollTop=0};
 previewFilterMenu.hidden=false;renderPreviewFilterValues();
 const rect=button.getBoundingClientRect();previewFilterMenu.style.left=Math.max(6,Math.min(rect.left,innerWidth-previewFilterMenu.offsetWidth-6))+'px';previewFilterMenu.style.top=Math.max(6,Math.min(rect.bottom+4,innerHeight-previewFilterMenu.offsetHeight-6))+'px';$('previewValueSearch').focus({preventScroll:true});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!previewFilterMenu.hidden){e.preventDefault();closePreviewFilter(true)}});
document.addEventListener('pointerdown',e=>{if(!previewFilterMenu.contains(e.target)&&!e.target.closest?.('[data-preview-filter]'))closePreviewFilter()},true);
document.addEventListener('scroll',e=>{if(!previewFilterMenu.contains(e.target))closePreviewFilter()},true);
window.addEventListener('resize',()=>closePreviewFilter());
