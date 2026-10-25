// Move existing DOM controls instead of recreating them: CSV, template and graph
// handlers remain attached to the same elements and keep their current state.
const sidebar=$('left'),tabs=sidebar.querySelector('.lefttabs');
const dataPanel=document.createElement('section');dataPanel.id='dataPanel';dataPanel.setAttribute('role','tabpanel');
const graphPanel=document.createElement('section');graphPanel.id='graphPanel';graphPanel.setAttribute('role','tabpanel');
const graphTab=document.createElement('button');graphTab.id='graphTab';graphTab.textContent='그래프설정';tabs.append(graphTab);tabs.setAttribute('role','tablist');
const originalDataElements=[...dataNodes];
sidebar.append(dataPanel,graphPanel);
// Folder location and actions now live only in the Data tab.
workspaceBar.classList.add('sidebarWorkspace');dataPanel.append(workspaceBar);
const csvActions=document.createElement('div');csvActions.className='sidebarActions';csvActions.append($('open'),$('demo'));dataPanel.append(csvActions);
const inputOptions=$('encoding').closest('.group');inputOptions.classList.add('sidebarOptions');dataPanel.append(inputOptions);
dataPanel.append(csvPanel);
for(const node of originalDataElements){if(node===csvPanel)continue;if(node.classList.contains('panelhead')||node.classList.contains('filecard'))dataPanel.append(node);else graphPanel.append(node)}
const graphHeading=document.createElement('div');graphHeading.className='panelhead';graphHeading.textContent='그래프 종류와 축 설정';graphPanel.prepend(graphHeading);
const graphOptions=document.createElement('div');graphOptions.className='sidebarGraphOptions';
graphOptions.append($('layout').closest('.group'),$('dimension').closest('.group'),$('taxis').closest('.group'));
graphPanel.insertBefore(graphOptions,graphHeading.nextSibling);
// Filters, explicit axis bounds and statistics belong with the graph controls.
const rightPanel=document.querySelector('.right');const analysisControls=document.createElement('section');analysisControls.className='sidebarAnalysis';analysisControls.append(...rightPanel.childNodes);graphPanel.append(analysisControls);rightPanel.remove();
// Preserve quick view/export actions beside the graph, without an upper ribbon.
const plotActions=document.createElement('div');plotActions.className='plotActions';plotActions.append($('reset'),$('png'),$('export'));document.querySelector('.docbar').append(plotActions);
const header=document.querySelector('header');header.append($('settingsOpen'));
document.querySelector('nav').remove();document.querySelector('.ribbon').remove();viewControls.remove();
// All three tabs share a single visibility implementation, including external calls.
showTab=function(which){const active=which==='template'?'template':which==='graph'?'graph':'data';for(const [key,panel,button] of [['data',dataPanel,$('dataTab')],['template',$('templatePanel'),$('templateTab')],['graph',graphPanel,graphTab]]){panel.hidden=key!==active;button.classList.toggle('on',key===active);button.setAttribute('role','tab');button.setAttribute('aria-selected',String(key===active));button.setAttribute('aria-controls',panel.id);panel.setAttribute('aria-labelledby',button.id);button.tabIndex=key===active?0:-1} };
$('dataTab').onclick=()=>showTab('data');$('templateTab').onclick=()=>showTab('template');graphTab.onclick=()=>showTab('graph');
tabs.addEventListener('keydown',e=>{const buttons=[$('dataTab'),$('templateTab'),graphTab],i=buttons.indexOf(e.target);if(i<0||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;showTab(['data','template','graph'][next]);buttons[next].focus()});
$('templatePanel').setAttribute('role','tabpanel');
$('templatePanel').querySelector('.help').textContent='작업폴더의 양식/ 폴더에 저장하며 시작 시 목록을 읽습니다. 양식을 선택한 뒤 CSV를 열어도 열 제목으로 자동 연결합니다.';
$('openTemplates').textContent='양식 가져오기';
// Remove only the empty marketing heading; keep zoom/pan controls above the plot.
const heading=document.querySelector('.heading');heading.firstElementChild.remove();heading.classList.add('graphInteractionBar');
// Keep the four live metrics and graph interactions on a single compact row.
heading.classList.add('graphSummaryBar');heading.prepend(document.querySelector('.metrics'));
const autoBounds=document.createElement('button');autoBounds.id='autoAxisBounds';autoBounds.type='button';autoBounds.textContent='축 범위 자동';
autoBounds.title='수동 축 범위와 확대·이동을 초기화합니다. 조건 필터는 유지합니다.';
autoBounds.onclick=()=>{if($('dimension').value==='3d'){scale3=1;offset3=[0,0]}reset()};
heading.querySelector('.mode').append(autoBounds);

showTab('data');

// Graph controls have a second tab row so the sidebar stays short.
const graphSubtabs=document.createElement('div');graphSubtabs.className='graphSubtabs';graphSubtabs.setAttribute('role','tablist');graphSubtabs.setAttribute('aria-label','그래프 설정 분류');
const graphSections={};const axisNodes=[...graphPanel.children].filter(n=>n!==graphHeading&&n!==graphOptions&&n!==analysisControls);
for(const [key,title] of [['kind','그래프 종류'],['axes','축 설정'],['range','스케일·값 범위']]){
 const button=document.createElement('button');button.id='graphSubtab-'+key;button.textContent=title;button.type='button';button.setAttribute('role','tab');
 const panel=document.createElement('section');panel.id='graphSection-'+key;panel.className='graphSection';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);button.setAttribute('aria-controls',panel.id);
 graphSubtabs.append(button);graphPanel.append(panel);graphSections[key]={button,panel};button.onclick=()=>openGraphSection(key);
}
graphHeading.textContent='그래프 설정';graphHeading.after(graphSubtabs);
function moveLabel(id,panel){panel.append($(id).closest('label'))}
for(const id of ['dimension','layout','style','timeMode'])moveLabel(id,graphSections.kind.panel);
for(const id of ['yaxis3','zaxis','taxis'])moveLabel(id,graphSections.axes.panel);
// Keep X, single/multi selection, search and signal checkboxes in one axis page.
for(const node of axisNodes){if(node.classList.contains('hint'))graphSections.kind.panel.append(node);else graphSections.axes.panel.append(node)}
graphSections.range.panel.append(analysisControls);graphOptions.remove();
function openGraphSection(key,focusTarget=false){if(!graphSections[key])key='kind';showTab('graph');for(const [k,{panel,button}] of Object.entries(graphSections)){panel.hidden=k!==key;button.classList.toggle('on',k===key);button.setAttribute('aria-selected',String(k===key));button.tabIndex=k===key?0:-1}sidebar.scrollTop=0;if(focusTarget)graphSections[key].button.focus({preventScroll:true})}
graphSubtabs.addEventListener('keydown',e=>{const keys=Object.keys(graphSections),i=keys.findIndex(k=>graphSections[k].button===e.target);if(i<0||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;openGraphSection(keys[next],true)});
openGraphSection('kind');showTab('data');

// Canvas context menu opens the same sidebar controls as the tab buttons.
const graphContextMenu=document.createElement('div');graphContextMenu.id='graphContextMenu';graphContextMenu.hidden=true;graphContextMenu.setAttribute('role','menu');graphContextMenu.setAttribute('aria-label','그래프 설정 바로가기');
for(const [key,label] of [['kind','그래프 종류'],['axes','축 설정'],['range','스케일·값 범위']]){const item=document.createElement('button');item.type='button';item.textContent=label;item.setAttribute('role','menuitem');item.onclick=()=>{closeGraphMenu();openGraphSection(key,true)};graphContextMenu.append(item)}
document.body.append(graphContextMenu);
function closeGraphMenu(returnFocus=false){graphContextMenu.hidden=true;if(returnFocus)$('plot').focus({preventScroll:true})}
function showGraphMenu(x,y){graphContextMenu.hidden=false;const r=graphContextMenu.getBoundingClientRect();graphContextMenu.style.left=Math.max(6,Math.min(x,innerWidth-r.width-6))+'px';graphContextMenu.style.top=Math.max(6,Math.min(y,innerHeight-r.height-6))+'px';graphContextMenu.firstElementChild.focus({preventScroll:true})}
$('plot').tabIndex=0;$('plot').addEventListener('contextmenu',e=>{e.preventDefault();$('tooltip').style.display='none';showGraphMenu(e.clientX,e.clientY)});
$('plot').addEventListener('keydown',e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=$('plot').getBoundingClientRect();showGraphMenu(r.left+r.width/2,r.top+r.height/2)}});
graphContextMenu.addEventListener('keydown',e=>{const items=[...graphContextMenu.children],i=items.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();closeGraphMenu(true)}else if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:items.length-1))%items.length;items[next].focus()}else if(e.key==='Tab')closeGraphMenu()});
document.addEventListener('pointerdown',e=>{if(!graphContextMenu.contains(e.target))closeGraphMenu()},true);
window.addEventListener('resize',()=>closeGraphMenu());window.addEventListener('blur',()=>closeGraphMenu());document.addEventListener('scroll',()=>closeGraphMenu(),true);
