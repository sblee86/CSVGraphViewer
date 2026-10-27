// A resizable divider replaces the repeated heading between the two tab rows.
const graphTabDivider = document.createElement('div');
graphTabDivider.id = 'graphTabDivider';
graphTabDivider.tabIndex = 0;
graphTabDivider.setAttribute('role', 'separator');
graphTabDivider.setAttribute('aria-orientation', 'horizontal');
graphTabDivider.setAttribute('aria-label', '그래프 탭 사이 높이 조절');
graphTabDivider.title = '위아래로 드래그하거나 방향키로 탭 사이 높이를 조절합니다.';
graphHeading.replaceWith(graphTabDivider);
const applyPanelsBeforeTabGap = window.applyPanelPrefs;
window.applyPanelPrefs = function () {
  applyPanelsBeforeTabGap();
  graphTabDivider.style.height = viewerPrefs.graphTabGap + 'px';
  graphTabDivider.setAttribute('aria-valuemin', '2');
  graphTabDivider.setAttribute('aria-valuemax', '48');
  graphTabDivider.setAttribute('aria-valuenow', String(viewerPrefs.graphTabGap));
};
let graphGapDrag = null;
function setGraphTabGap(value) {
  viewerPrefs.graphTabGap = Math.max(2, Math.min(48, Math.round(value)));
  window.applyPanelPrefs();
}
graphTabDivider.onpointerdown = (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  graphGapDrag = { y: e.clientY, gap: viewerPrefs.graphTabGap };
  graphTabDivider.setPointerCapture(e.pointerId);
};
graphTabDivider.onpointermove = (e) => {
  if (graphGapDrag) {
    e.preventDefault();
    setGraphTabGap(graphGapDrag.gap + e.clientY - graphGapDrag.y);
  }
};
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
  graphTabDivider.addEventListener(name, () => {
    if (graphGapDrag) {
      graphGapDrag = null;
      savePanelPrefsSoon();
    }
  });
graphTabDivider.onkeydown = (e) => {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  setGraphTabGap(
    e.key === 'Home'
      ? 2
      : e.key === 'End'
        ? 48
        : viewerPrefs.graphTabGap + (e.key === 'ArrowDown' ? 2 : -2),
  );
  savePanelPrefsSoon();
};

const axisHelpFooter = document.createElement('div');
axisHelpFooter.className = 'axisHelpFooter';
axisHelpFooter.innerHTML =
  '<button id="axisHelpOpen" class="sidebarAction">? 축·시간·범위 도움말</button>';
graphPanel.append(axisHelpFooter);
const axisHelp = document.createElement('section');
axisHelp.id = 'axisHelpWindow';
axisHelp.hidden = true;
axisHelp.tabIndex = -1;
axisHelp.setAttribute('role', 'dialog');
axisHelp.setAttribute('aria-modal', 'false');
axisHelp.setAttribute('aria-labelledby', 'axisHelpTitle');
axisHelp.innerHTML = `<header id="axisHelpDrag" tabindex="0" title="드래그 또는 방향키로 이동"><b id="axisHelpTitle">축·시간·범위 설정 도움말</b><button id="axisHelpClose" aria-label="축 도움말 닫기">닫기 ×</button></header><div class="axisHelpBody"><p>이 창을 열어 둔 채 그래프와 설정을 조작할 수 있습니다. 제목줄을 끌어 이동하고 오른쪽 아래 모서리로 크기를 조절하세요. Ctrl+휠 또는 제목줄의 −/+/100%로 이 창만 확대·축소합니다.</p>
<h3>예시 CSV — 첫 행은 열 이름</h3><table><thead><tr><th>Time_s</th><th>X_m</th><th>Y_m</th><th>Z_m</th><th>Speed</th></tr></thead><tbody><tr><td>0</td><td>1</td><td>2</td><td>0</td><td>10</td></tr><tr><td>1</td><td>2</td><td>4</td><td>1</td><td>12</td></tr><tr><td>2</td><td>3</td><td>3</td><td>2</td><td>15</td></tr></tbody></table>
<h3>X축 — 가로 기준</h3><p>2D에서 X=Time_s, Y신호=Speed를 선택하면 시간 0·1·2초에 속도 10·12·15가 표시됩니다. X축을 X_m으로 바꾸면 같은 속도값을 위치 1·2·3에 대응해 그립니다. 행 번호를 고르면 X는 첫 번째 데이터부터 1·2·3입니다.</p><p>여러 CSV는 각각 자기 파일의 X열로 그립니다. 공통 X열은 같은 열 이름으로 연결하며, 파일별 X축에서 따로 선택할 수 있습니다. 없는 X열은 첫 숫자 열을 사용하고 경고합니다. CSV끼리 행을 합치거나 시간을 보간하지 않습니다.</p>
<h3>Y신호 — 2D에서 비교할 값</h3><p>Y신호 체크박스는 세로축으로 그릴 열입니다. Speed만 체크하면 속도 하나, Speed와 Y_m을 함께 체크하면 두 신호를 비교합니다. 신호별 개별 보기를 켜면 각각 나누고, 끄면 겹칩니다. 단위가 다른 값은 개별 보기가 읽기 쉽습니다. 빈 숫자 셀은 0이 아니라 결측값으로 선이 끊깁니다.</p>
<h3>X·Y·Z — 3D 공간 좌표</h3><p>3D에서는 같은 CSV의 X=X_m, Y=Y_m, Z=Z_m을 선택합니다. 예시에서는 (1,2,0) → (2,4,1) → (3,3,2)를 잇는 궤적입니다. 이 Y축은 2D의 복수 Y신호 체크 목록과 달리 좌표 열 하나입니다.</p><p>각 축은 해당 데이터 범위로 정규화합니다. X 1m와 Z 1m가 화면에서 같은 길이라는 뜻은 아닙니다. 3D 축 범위는 자동 계산하며 수동 X/Y 표시 범위 입력은 2D용입니다.</p>
<h3>T / 시간 — 궤적 순서와 재생</h3><p>T=Time_s를 선택하면 숫자 시간 오름차순으로 점을 연결합니다. 같은 시간은 원래 행 순서를 유지합니다. T=행 순서는 파일에 저장된 순서대로 진행합니다. T는 추가 공간축이 아니며, X를 자동으로 시간 열로 바꾸지도 않습니다.</p><p>시간 표시가 전체 구간이면 모두 표시합니다. 현재 T까지 궤적으로 바꾸면 슬라이더와 재생으로 표시 구간을 늘릴 수 있습니다. 2D에서도 사용할 수 있습니다. 날짜 문자열은 직접 시간으로 해석하지 않으며, 재생은 행 진행 방식이어서 실제 시간 간격을 그대로 재현하지는 않습니다.</p>
<h3>조건 범위 — 어떤 행을 남길지</h3><p>Speed 최소 11, 최대 13이면 값 12인 행만 남습니다. 최소·최대는 포함합니다. 조건을 여러 개 추가하면 모두 만족해야 합니다(AND). 여러 CSV에서는 조건 열이 속한 파일에만 적용합니다. 이 조건은 필터 CSV 저장 행에도 반영됩니다.</p>
<h3>축 표시 범위 — 어디를 확대해 볼지</h3><p>X 최소 0, 최대 1, Y 최소 8, 최대 13을 입력하고 사용자 축 설정 적용을 누르면 그 구간을 화면에 표시합니다. 원본 행을 삭제하거나 CSV 저장 행을 제한하는 기능은 아닙니다. 빈 입력은 데이터 자동 범위를 사용하며 최소는 최대보다 작아야 합니다.</p><p>축 범위 자동은 화면 확대·이동과 수동 표시 범위를 자동으로 돌립니다. 입력해 둔 값은 남겨 두므로 사용자 축 설정 적용으로 다시 불러올 수 있습니다. 조건 필터는 유지됩니다. 3D에서는 확대·이동을 복원하며 회전 시점은 유지합니다.</p>
<h3>통계·미리보기·저장</h3><p>선택 신호 통계는 그래프 조건을 통과한 유효 숫자의 최소·최대·평균·개수입니다. 미리보기 표의 체크 필터·정렬은 그래프와 별도이며, 표의 데이터 행 번호는 원본 레코드 순서입니다. CSV 내보내기는 그래프 조건을 적용하지만 화면 확대 범위·T 재생 구간·미리보기 표 필터는 적용하지 않습니다.</p>
<h3>빠르게 그려 보기</h3><ol><li>데이터에서 CSV를 엽니다.</li><li>그래프 종류에서 2D를 선택합니다.</li><li>축 설정에서 X=Time_s와 Y신호=Speed를 선택합니다.</li><li>필요하면 조건 범위를 추가하거나 수동 축 범위를 적용합니다.</li><li>3D 궤적을 보려면 차원을 3D로 바꾸고 X_m·Y_m·Z_m과 T=Time_s를 선택합니다.</li><li>양식에 저장하면 파일·열·그래프 설정을 다시 불러올 수 있습니다.</li></ol></div>`;
document.body.append(axisHelp);
let axisHelpDrag = null;
function positionAxisHelp(left, top) {
  const r = axisHelp.getBoundingClientRect();
  axisHelp.style.left = Math.max(0, Math.min(left, innerWidth - r.width)) + 'px';
  axisHelp.style.top = Math.max(0, Math.min(top, innerHeight - r.height)) + 'px';
}
$('axisHelpOpen').onclick = () => {
  const first = axisHelp.hidden;
  axisHelp.hidden = false;
  if (first && !axisHelp.style.left)
    positionAxisHelp(sidebar.getBoundingClientRect().right + 12, 90);
  else positionAxisHelp(parseFloat(axisHelp.style.left) || 0, parseFloat(axisHelp.style.top) || 0);
  axisHelp.focus({ preventScroll: true });
};
$('axisHelpClose').onclick = () => {
  axisHelp.hidden = true;
  axisHelpDrag = null;
  $('axisHelpOpen').focus({ preventScroll: true });
};
window.applyPanelPrefs();
