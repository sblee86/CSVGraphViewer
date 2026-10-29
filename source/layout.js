// Move existing DOM controls instead of recreating them: CSV, template and graph
// handlers remain attached to the same elements and keep their current state.
const sidebar = $('left'),
  tabs = sidebar.querySelector('.lefttabs');
const dataPanel = document.createElement('section');
dataPanel.id = 'dataPanel';
dataPanel.setAttribute('role', 'tabpanel');
const graphPanel = document.createElement('section');
graphPanel.id = 'graphPanel';
graphPanel.setAttribute('role', 'tabpanel');
const graphTab = document.createElement('button');
graphTab.id = 'graphTab';
graphTab.textContent = '그래프설정';
tabs.append(graphTab);
tabs.setAttribute('role', 'tablist');
const originalDataElements = [...dataNodes];
sidebar.append(dataPanel, graphPanel);
// Folder location and actions now live only in the Data tab.
workspaceBar.classList.add('sidebarWorkspace');
dataPanel.append(workspaceBar);
const csvActions = document.createElement('div');
csvActions.className = 'sidebarActions';
csvActions.append($('open'));
dataPanel.append(csvActions);
const inputOptions = $('encoding').closest('.group');
inputOptions.classList.add('sidebarOptions');
dataPanel.append(inputOptions);
dataPanel.append(csvPanel);
for (const node of originalDataElements) {
  if (node === csvPanel) continue;
  if (node.classList.contains('panelhead') || node.classList.contains('filecard'))
    dataPanel.append(node);
  else graphPanel.append(node);
}
const graphHeading = document.createElement('div');
graphHeading.className = 'panelhead';
graphHeading.textContent = '그래프 종류와 축 설정';
graphPanel.prepend(graphHeading);
const graphOptions = document.createElement('div');
graphOptions.className = 'sidebarGraphOptions';
graphOptions.append(
  $('layout').closest('.group'),
  $('dimension').closest('.group'),
  $('taxis').closest('.group'),
);
graphPanel.insertBefore(graphOptions, graphHeading.nextSibling);
// Filters, explicit axis bounds and statistics belong with the graph controls.
const rightPanel = document.querySelector('.right');
const analysisControls = document.createElement('section');
analysisControls.className = 'sidebarAnalysis';
analysisControls.append(...rightPanel.childNodes);
graphPanel.append(analysisControls);
rightPanel.remove();
// Preserve quick view/export actions beside the graph, without an upper ribbon.
const plotActions = document.createElement('div');
plotActions.className = 'plotActions';
plotActions.append($('reset'), $('png'), $('export'));
document.querySelector('.docbar').append(plotActions);
const header = document.querySelector('header');
header.append($('settingsOpen'));
document.querySelector('nav').remove();
document.querySelector('.ribbon').remove();
viewControls.remove();
// All three tabs share a single visibility implementation, including external calls.
showTab = function (which) {
  const active = which === 'template' ? 'template' : which === 'graph' ? 'graph' : 'data';
  for (const [key, panel, button] of [
    ['data', dataPanel, $('dataTab')],
    ['template', $('templatePanel'), $('templateTab')],
    ['graph', graphPanel, graphTab],
  ]) {
    panel.hidden = key !== active;
    button.classList.toggle('on', key === active);
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(key === active));
    button.setAttribute('aria-controls', panel.id);
    panel.setAttribute('aria-labelledby', button.id);
    button.tabIndex = key === active ? 0 : -1;
  }
};
$('dataTab').onclick = () => showTab('data');
$('templateTab').onclick = () => showTab('template');
graphTab.onclick = () => showTab('graph');
tabs.addEventListener('keydown', (e) => {
  const buttons = [$('dataTab'), $('templateTab'), graphTab],
    i = buttons.indexOf(e.target);
  if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const next =
    e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
  showTab(['data', 'template', 'graph'][next]);
  buttons[next].focus();
});
$('templatePanel').setAttribute('role', 'tabpanel');
$('templatePanel').querySelector('.help').textContent =
  '작업폴더의 양식/ 폴더에 저장하며 시작 시 목록을 읽습니다. 양식을 선택한 뒤 CSV를 열어도 열 제목으로 자동 연결합니다.';
$('openTemplates').textContent = '양식 가져오기';
// Remove only the empty marketing heading; keep zoom/pan controls above the plot.
const heading = document.querySelector('.heading');
heading.firstElementChild.remove();
heading.classList.add('graphInteractionBar');
// Keep the four live metrics and graph interactions on a single compact row.
heading.classList.add('graphSummaryBar');
heading.prepend(document.querySelector('.metrics'));
const autoBounds = document.createElement('button');
autoBounds.id = 'autoAxisBounds';
autoBounds.type = 'button';
autoBounds.textContent = '축 범위 자동';
autoBounds.title = '수동 축 범위와 확대·이동을 초기화합니다. 조건 필터는 유지합니다.';
autoBounds.onclick = () => {
  view = null;
  manualY = null;
  if ($('dimension').value === '3d') {
    scale3 = 1;
    offset3 = [0, 0];
  }
  draw();
};
const customBounds = document.createElement('button');
customBounds.id = 'applyUserAxisBounds';
customBounds.type = 'button';
customBounds.textContent = '사용자 축 설정 적용';
customBounds.title = '그래프설정의 스케일·값 범위에 입력한 X/Y 범위를 적용합니다 (2D).';
customBounds.onclick = () => {
  if ($('dimension').value === '3d')
    return notice('사용자 축 범위는 2D 그래프에서 적용할 수 있습니다.');
  $('applybounds').click();
};
$('zoom').lastChild.textContent = ' 확대';
const graphModeButtons = heading.querySelector('.mode');
graphModeButtons.replaceChildren(autoBounds, customBounds, $('zoom'), $('pan'));
for (const label of heading.querySelectorAll('.metrics small'))
  label.textContent = label.textContent.replace(/[:：]\s*$/, '') + ':';
// Grow each button to 120% of its label's natural width plus normal padding.
const graphActionSizer = new ResizeObserver((entries) => {
  for (const { target } of entries) {
    const button = target.parentElement,
      css = getComputedStyle(button),
      padding = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight);
    button.style.width = Math.ceil((target.getBoundingClientRect().width + padding) * 1.2) + 'px';
  }
});
for (const button of graphModeButtons.children) {
  const label = document.createElement('span');
  label.className = 'graphActionLabel';
  label.append(...button.childNodes);
  button.append(label);
  graphActionSizer.observe(label);
}

const quickLayoutLabel = document.createElement('label');
quickLayoutLabel.className = 'quickGraphLayout';
quickLayoutLabel.title = '체크: 신호별 개별 그래프 / 해제: 한 그래프에 겹쳐 보기 (2D)';
quickLayoutLabel.innerHTML =
  '<input type="checkbox" id="quickGraphSplit"><span>신호별 개별 보기</span>';
autoBounds.before(quickLayoutLabel);
function syncQuickGraphLayout() {
  const box = $('quickGraphSplit');
  box.checked = $('layout').value === 'split';
  box.disabled = $('dimension').value === '3d';
}
$('quickGraphSplit').onchange = () => {
  $('layout').value = $('quickGraphSplit').checked ? 'split' : 'overlay';
  draw();
};
$('layout').onchange = () => draw();
const drawBeforeQuickGraphLayout = draw;
draw = function () {
  syncQuickGraphLayout();
  drawBeforeQuickGraphLayout();
};
syncQuickGraphLayout();
showTab('data');

// Two menu rows separate general graph options from individual coordinate axes.
const graphSubtabs = document.createElement('div');
graphSubtabs.className = 'graphSubtabs';
graphSubtabs.setAttribute('role', 'tablist');
graphSubtabs.setAttribute('aria-label', '그래프 설정 분류');
const graphSections = {};
const axisNodes = [...graphPanel.children].filter(
  (n) => n !== graphHeading && n !== graphOptions && n !== analysisControls,
);
for (const [key, title] of [
  ['kind', '그래프 종류'],
  ['range', '스케일·범위'],
  ['x', 'X축 설정'],
  ['y', 'Y축 설정'],
  ['z', 'Z축 설정 (3D)'],
]) {
  const button = document.createElement('button');
  button.id = 'graphSubtab-' + key;
  button.textContent = title;
  button.type = 'button';
  button.setAttribute('role', 'tab');
  const panel = document.createElement('section');
  panel.id = 'graphSection-' + key;
  panel.className = 'graphSection';
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', button.id);
  button.setAttribute('aria-controls', panel.id);
  graphSubtabs.append(button);
  graphPanel.append(panel);
  graphSections[key] = { button, panel };
  button.onclick = () => openGraphSection(key);
}
graphHeading.textContent = '그래프 설정';
graphHeading.after(graphSubtabs);
function moveLabel(id, panel) {
  panel.append($(id).closest('label'));
}
for (const id of ['dimension', 'style', 'timeMode']) moveLabel(id, graphSections.kind.panel);
moveLabel('layout', graphSections.y.panel);
moveLabel('yaxis3', graphSections.y.panel);
moveLabel('zaxis', graphSections.z.panel);
moveLabel('taxis', graphSections.x.panel);
const originalXAxisCaption = $('x').previousElementSibling;
// Preserve existing elements and their handlers while splitting the axis pages.
for (const node of axisNodes) {
  if (node.classList.contains('hint')) graphSections.kind.panel.append(node);
  else if (node === $('x') || node === originalXAxisCaption) graphSections.x.panel.append(node);
  else graphSections.y.panel.append(node);
}
graphSections.range.panel.append(analysisControls);
graphOptions.remove();
function openGraphSection(key, focusTarget = false, revealSidebar = true) {
  if (key === 'axes') key = 'y'; // Legacy internal shortcuts open Y signals.
  if (key === 'z' && $('dimension').value !== '3d') key = 'y';
  if (!graphSections[key]) key = 'kind';
  if (revealSidebar) showTab('graph');
  for (const [k, { panel, button }] of Object.entries(graphSections)) {
    panel.hidden = k !== key;
    button.classList.toggle('on', k === key);
    button.setAttribute('aria-selected', String(k === key));
    button.tabIndex = k === key ? 0 : -1;
  }
  sidebar.scrollTop = 0;
  if (focusTarget) graphSections[key].button.focus({ preventScroll: true });
}
graphSubtabs.addEventListener('keydown', (e) => {
  const keys = Object.keys(graphSections).filter((key) => !graphSections[key].button.hidden),
    i = keys.findIndex((k) => graphSections[k].button === e.target);
  if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? keys.length - 1
        : (i + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length;
  openGraphSection(keys[next], true);
});
openGraphSection('kind');
showTab('data');

// Canvas context menu opens the same sidebar controls as the tab buttons.
const graphContextMenu = document.createElement('div');
graphContextMenu.id = 'graphContextMenu';
graphContextMenu.hidden = true;
graphContextMenu.setAttribute('role', 'menu');
graphContextMenu.setAttribute('aria-label', '그래프 설정 바로가기');
for (const [key, label] of [
  ['kind', '그래프 종류'],
  ['range', '스케일·범위'],
  ['x', 'X축 설정'],
  ['y', 'Y축 설정'],
  ['z', 'Z축 설정 (3D)'],
]) {
  const item = document.createElement('button');
  item.type = 'button';
  item.textContent = label;
  item.dataset.graphSection = key;
  item.setAttribute('role', 'menuitem');
  item.onclick = () => {
    closeGraphMenu();
    openGraphSection(key, true);
  };
  graphContextMenu.append(item);
}
document.body.append(graphContextMenu);
function closeGraphMenu(returnFocus = false) {
  graphContextMenu.hidden = true;
  if (returnFocus) $('plot').focus({ preventScroll: true });
}
function showGraphMenu(x, y) {
  graphContextMenu.hidden = false;
  const r = graphContextMenu.getBoundingClientRect();
  graphContextMenu.style.left = Math.max(6, Math.min(x, innerWidth - r.width - 6)) + 'px';
  graphContextMenu.style.top = Math.max(6, Math.min(y, innerHeight - r.height - 6)) + 'px';
  graphContextMenu.firstElementChild.focus({ preventScroll: true });
}
$('plot').tabIndex = 0;
$('plot').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  $('tooltip').style.display = 'none';
  showGraphMenu(e.clientX, e.clientY);
});
$('plot').addEventListener('keydown', (e) => {
  if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
    e.preventDefault();
    const r = $('plot').getBoundingClientRect();
    showGraphMenu(r.left + r.width / 2, r.top + r.height / 2);
  }
});
graphContextMenu.addEventListener('keydown', (e) => {
  const items = [...graphContextMenu.children],
    i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') {
    e.preventDefault();
    closeGraphMenu(true);
  } else if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
    items[next].focus();
  } else if (e.key === 'Tab') closeGraphMenu();
});
document.addEventListener(
  'pointerdown',
  (e) => {
    if (!graphContextMenu.contains(e.target)) closeGraphMenu();
  },
  true,
);
window.addEventListener('resize', () => closeGraphMenu());
window.addEventListener('blur', () => closeGraphMenu());
document.addEventListener('scroll', () => closeGraphMenu(), true);
