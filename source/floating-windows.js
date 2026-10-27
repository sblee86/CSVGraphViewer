// Nonmodal windows stay independent from the graph and support local zoom.
let floatingWindowZ = 30;
function installFloatingWindow(element, handle) {
  let drag = null;
  let scale = 1;
  element.classList.add('floatingWindow');
  handle.classList.add('floatingWindowHandle');
  handle.tabIndex = 0;
  handle.title = '상단 드래그·방향키: 이동 / Ctrl+휠: 이 창만 확대·축소';

  function position(left, top) {
    const rect = element.getBoundingClientRect();
    element.style.left = Math.max(0, Math.min(left, innerWidth - rect.width)) + 'px';
    element.style.top = Math.max(0, Math.min(top, innerHeight - rect.height)) + 'px';
  }
  function keepVisible() {
    if (element.hidden || (element.tagName === 'DIALOG' && !element.open)) return;
    const rect = element.getBoundingClientRect();
    position(rect.left, rect.top);
  }
  function zoomTo(value) {
    scale = Math.max(0.65, Math.min(1.5, Math.round(value * 100) / 100));
    element.style.setProperty('--floating-scale', scale);
    percentage.textContent = Math.round(scale * 100) + '%';
    keepVisible();
  }
  const zoomControls = document.createElement('span');
  zoomControls.className = 'floatingZoom';
  const smaller = document.createElement('button');
  smaller.type = 'button';
  smaller.textContent = '−';
  smaller.setAttribute('aria-label', '창 축소');
  const percentage = document.createElement('button');
  percentage.type = 'button';
  percentage.textContent = '100%';
  percentage.title = '기본 배율로 복원';
  const bigger = document.createElement('button');
  bigger.type = 'button';
  bigger.textContent = '+';
  bigger.setAttribute('aria-label', '창 확대');
  zoomControls.append(smaller, percentage, bigger);
  const close = handle.querySelector('button');
  if (close) close.before(zoomControls);
  else handle.append(zoomControls);
  smaller.onclick = () => zoomTo(scale - 0.1);
  bigger.onclick = () => zoomTo(scale + 0.1);
  percentage.onclick = () => zoomTo(1);
  element.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      zoomTo(scale + (event.deltaY < 0 ? 0.1 : -0.1));
    },
    { passive: false },
  );
  element.addEventListener('pointerdown', () => {
    element.style.zIndex = ++floatingWindowZ;
  });
  handle.onpointerdown = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    handle.setPointerCapture(event.pointerId);
  };
  handle.onpointermove = (event) => {
    if (!drag) return;
    event.preventDefault();
    position(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
  };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    handle.addEventListener(name, () => {
      drag = null;
    });
  }
  handle.onkeydown = (event) => {
    if (
      event.target !== handle ||
      !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
    )
      return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    position(
      rect.left + (event.key === 'ArrowLeft' ? -10 : event.key === 'ArrowRight' ? 10 : 0),
      rect.top + (event.key === 'ArrowUp' ? -10 : event.key === 'ArrowDown' ? 10 : 0),
    );
  };
  window.addEventListener('resize', keepVisible);
  new ResizeObserver(keepVisible).observe(element);
  return {
    position,
    zoomTo,
    raise: () => {
      element.style.zIndex = ++floatingWindowZ;
    },
  };
}

const settingsTitle = document.createElement('div');
settingsTitle.id = 'settingsWindowTitle';
const settingsClose = document.createElement('button');
settingsClose.type = 'button';
settingsClose.id = 'settingsWindowClose';
settingsClose.textContent = '닫기 ×';
settingsClose.setAttribute('aria-label', '설정 취소하고 닫기');
settingsClose.onclick = cancelPrefs;
settingsTitle.append(settingsDialog.querySelector('h2'), settingsClose);
settingsDialog.prepend(settingsTitle);
settingsDialog.setAttribute('aria-modal', 'false');
settingsDialog.setAttribute('aria-label', 'CSVtoGraphViewer 설정');
const settingsFloating = installFloatingWindow(settingsDialog, settingsTitle);
const openSettingsBeforeFloating = $('settingsOpen').onclick;
$('settingsOpen').onclick = () => {
  if (settingsDialog.open) {
    settingsFloating.raise();
    settingsDialog.focus({ preventScroll: true });
    return;
  }
  openSettingsBeforeFloating();
  if (!settingsDialog.style.left)
    settingsFloating.position(Math.max(12, (innerWidth - settingsDialog.offsetWidth) / 2), 60);
  settingsFloating.raise();
};
settingsDialog.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    cancelPrefs();
  }
});
installFloatingWindow(axisHelp, $('axisHelpDrag'));
