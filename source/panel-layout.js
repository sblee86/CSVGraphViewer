// Panel layout belongs to workspace preferences, independently of graph templates.
const buildLabel=document.querySelector('header .local'),build=window.CSV_GRAPH_BUILD;
buildLabel.classList.add('buildLabel');buildLabel.textContent=build?'v'+build.version+'_'+build.built_at.slice(0,19).replace('T',' '):'빌드 정보 없음';buildLabel.title='소스 수정 후 빌드할 때 버전과 빌드 시간이 갱신됩니다. 빌드 시간: 한국 표준시(KST)';
const mainPane=document.querySelector('main'),mainContent=mainPane.querySelector('.content'),graphScroller=document.createElement('div');graphScroller.className='mainGraphScroll';mainContent.before(graphScroller);graphScroller.append(mainContent);
const oldPlot=document.querySelector('.plotcard'),graphDisclosure=document.createElement('details');graphDisclosure.id='graphDisclosure';graphDisclosure.className='plotcard';
const graphSummary=document.createElement('summary');graphSummary.className='plothead';graphSummary.append(...oldPlot.querySelector('.plothead').childNodes);oldPlot.querySelector('.plothead').remove();graphDisclosure.append(graphSummary,...oldPlot.childNodes);oldPlot.replaceWith(graphDisclosure);
const previewPin=document.createElement('button');previewPin.id='previewPin';previewPin.type='button';previewPin.textContent='하단 고정';previewPin.title='미리보기를 메인 영역 하단에 고정하거나 해제합니다.';previewSummary.append(previewPin);
const previewResize=document.createElement('div');previewResize.id='previewDockResize';previewResize.tabIndex=0;previewResize.setAttribute('role','separator');previewResize.setAttribute('aria-orientation','horizontal');previewResize.setAttribute('aria-label','고정 미리보기 높이 조절');previewResize.title='위아래로 드래그 또는 방향키로 높이 조절';dataPreview.append(previewResize);
let panelSaveTimer=null,panelSaveQueue=Promise.resolve(),previewResizeDrag=null;
function savePanelPrefsSoon(){
 fillPrefs();const root=workRoot,epoch=workspaceEpoch;clearTimeout(panelSaveTimer);
 panelSaveTimer=setTimeout(()=>{panelSaveQueue=panelSaveQueue.then(async()=>{if(root&&root===workRoot&&epoch===workspaceEpoch&&!settingsDialog.open)await saveViewerPrefs()}).catch(e=>notice('창 배치 저장 실패: '+e.message))},200);
}
window.applyPanelPrefs=function(){
 graphDisclosure.open=!viewerPrefs.graphCollapsed;dataPreview.open=!viewerPrefs.previewCollapsed;
 mainPane.classList.toggle('previewDocked',viewerPrefs.previewPinned);dataPreview.classList.toggle('docked',viewerPrefs.previewPinned);
 const parent=viewerPrefs.previewPinned?mainPane:mainContent;if(dataPreview.parentElement!==parent)parent.append(dataPreview);
 mainPane.style.setProperty('--preview-dock-height',viewerPrefs.previewHeight+'px');previewPin.textContent=viewerPrefs.previewPinned?'고정 해제':'하단 고정';previewPin.setAttribute('aria-pressed',String(viewerPrefs.previewPinned));
 previewResize.setAttribute('aria-valuemin','160');previewResize.setAttribute('aria-valuemax','800');previewResize.setAttribute('aria-valuenow',String(viewerPrefs.previewHeight));
};
graphDisclosure.addEventListener('toggle',()=>{const collapsed=!graphDisclosure.open;if(viewerPrefs.graphCollapsed!==collapsed){viewerPrefs.graphCollapsed=collapsed;savePanelPrefsSoon()}if(graphDisclosure.open)requestAnimationFrame(()=>draw())});
dataPreview.addEventListener('toggle',()=>{const collapsed=!dataPreview.open;if(viewerPrefs.previewCollapsed!==collapsed){viewerPrefs.previewCollapsed=collapsed;savePanelPrefsSoon()}});
previewPin.onclick=e=>{e.preventDefault();e.stopPropagation();viewerPrefs.previewPinned=!viewerPrefs.previewPinned;viewerPrefs.previewCollapsed=false;window.applyPanelPrefs();savePanelPrefsSoon();requestAnimationFrame(()=>draw())};
function resizeDock(height){viewerPrefs.previewHeight=Math.max(160,Math.min(800,Math.round(height)));window.applyPanelPrefs()}
previewResize.onpointerdown=e=>{if(e.button!==0||!viewerPrefs.previewPinned)return;e.preventDefault();previewResizeDrag={y:e.clientY,height:dataPreview.getBoundingClientRect().height};previewResize.setPointerCapture(e.pointerId)};
previewResize.onpointermove=e=>{if(!previewResizeDrag)return;e.preventDefault();resizeDock(previewResizeDrag.height+previewResizeDrag.y-e.clientY)};
for(const name of ['pointerup','pointercancel','lostpointercapture'])previewResize.addEventListener(name,()=>{if(previewResizeDrag){previewResizeDrag=null;savePanelPrefsSoon();draw()}});
previewResize.onkeydown=e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();resizeDock(e.key==='Home'?160:e.key==='End'?800:viewerPrefs.previewHeight+(e.key==='ArrowUp'?10:-10));savePanelPrefsSoon();draw()};
const pngBeforePanels=$('png').onclick;$('png').onclick=()=>{if(!graphDisclosure.open){viewerPrefs.graphCollapsed=false;window.applyPanelPrefs();savePanelPrefsSoon();requestAnimationFrame(()=>requestAnimationFrame(()=>{draw();pngBeforePanels()}))}else pngBeforePanels()};
window.applyPanelPrefs();
