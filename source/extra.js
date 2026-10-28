// Offline 3D projection and reusable graph templates. No remote dependencies.
const originalDraw = draw,
  originalUpdate = update,
  originalLoad = load,
  originalReset = reset;
let angleYaw = 0.65,
  anglePitch = 0.45,
  scale3 = 1,
  offset3 = [0, 0],
  gesture3 = null,
  playing = null,
  templates = [],
  templatePending = null;
$('layout')
  .closest('.group')
  .insertAdjacentHTML(
    'afterend',
    `<div class="group controls"><label>그래프 차원<select id="dimension"><option value="2d">2D 그래프</option><option value="3d">3D 궤적 그래프</option></select></label><label>Z축<select id="zaxis"></select></label><label>Y축 (3D)<select id="yaxis3"></select></label></div><div class="group controls"><label>T / 시간 기준<select id="taxis"></select></label><label>시간 표시<select id="timeMode"><option value="all">전체 구간</option><option value="trail">현재 T까지 궤적</option></select></label></div>`,
  );
const viewControls = document.createElement('div');
viewControls.className = 'viewControls';
document.querySelector('.ribbon').after(viewControls);
viewControls.append($('dimension').closest('.group'), $('taxis').closest('.group'));
$('plotwrap').insertAdjacentHTML(
  'afterend',
  `<div id="timebar"><button id="playtime">▶ 재생</button><input id="timeSlider" type="range" min="0" max="0" value="0"><span id="timeValue">T —</span></div>`,
);
$('left').insertAdjacentHTML(
  'afterbegin',
  `<div class="lefttabs"><button id="dataTab" class="on">데이터</button><button id="templateTab">양식</button></div><section id="templatePanel" hidden><div class="panelhead">그래프 양식</div><input id="templateName" placeholder="양식 이름" value="내 그래프"><button id="saveTemplate" class="solid">양식 저장 (.json)</button><div class="row"><button id="openTemplates">양식 파일 열기</button><button id="openFolder">폴더 열기</button></div><input id="templateSearch" placeholder="양식명 검색…"><div id="templateList"></div><p class="help">CSV는 포함되지 않습니다. CSV를 연 뒤 양식을 선택하거나, 양식을 먼저 선택한 뒤 CSV를 여세요. 열 제목으로 연결합니다. 폴더는 하위 폴더까지 읽습니다.</p></section>`,
);
const dataNodes = [...$('left').children].filter(
  (e) => !e.classList.contains('lefttabs') && e.id !== 'templatePanel',
);
function showTab(which) {
  dataNodes.forEach((e) => (e.hidden = which !== 'data'));
  $('templatePanel').hidden = which === 'data';
  $('dataTab').classList.toggle('on', which === 'data');
  $('templateTab').classList.toggle('on', which !== 'data');
}
$('dataTab').onclick = () => showTab('data');
$('templateTab').onclick = () => showTab('template');
document.body.insertAdjacentHTML(
  'beforeend',
  '<input hidden id="templateFiles" type="file" multiple accept=".json"><input hidden id="templateFolder" type="file" webkitdirectory multiple>',
);
function axisOptions() {
  for (let id of ['zaxis', 'yaxis3', 'taxis']) {
    let prev = $(id).value;
    $(id).innerHTML =
      (id === 'taxis' ? '<option value="-1">행 순서</option>' : '') +
      headers
        .map((h, i) =>
          numeric[i] && !window.isConditionalSignalIndex?.(i)
            ? `<option value="${i}">${esc(h)}</option>`
            : '',
        )
        .join('');
    if ([...$(id).options].some((o) => o.value === prev)) $(id).value = prev;
  }
  let nums = numeric
    .map((v, i) => (v && !window.isConditionalSignalIndex?.(i) ? i : -1))
    .filter((i) => i >= 0);
  $('yaxis3').value = String(nums[1] ?? nums[0] ?? '');
  $('zaxis').value = String(nums[2] ?? nums[0] ?? '');
  $('taxis').value = '-1';
}
load = function (text, name) {
  stopPlayback();
  originalLoad(text, name);
  axisOptions();
  if (templatePending) applyTemplate(templatePending);
  else update();
};
function ordered() {
  let ti = +$('taxis').value;
  return filtered
    .map((r) => ({ r, t: ti === -1 ? r.index + 1 : num(r.row[ti]) }))
    .filter((o) => Number.isFinite(o.t))
    .sort((a, b) => a.t - b.t || a.r.index - b.r.index);
}
function syncTime() {
  let list = ordered(),
    old = +$('timeSlider').value;
  $('timeSlider').max = Math.max(0, list.length - 1);
  $('timeSlider').value = Math.min(old, Math.max(0, list.length - 1));
  let at = list[+$('timeSlider').value];
  $('timeValue').textContent = at
    ? `T ${fmt(at.t)} · ${+$('timeSlider').value + 1}/${list.length}`
    : 'T —';
  $('timeSlider').disabled = $('timeMode').value === 'all';
  return list;
}
update = function () {
  originalUpdate();
  syncTime();
  draw();
};
function project3(x, y, z, w, h) {
  let a = x * Math.cos(angleYaw) - z * Math.sin(angleYaw),
    b = x * Math.sin(angleYaw) + z * Math.cos(angleYaw);
  let v = y * Math.cos(anglePitch) - b * Math.sin(anglePitch);
  let k = Math.min(w, h) * 0.29 * scale3;
  return [w / 2 + a * k + offset3[0], h / 2 - v * k + offset3[1]];
}
function draw3() {
  let canvas = $('plot'),
    w = canvas.clientWidth,
    h = canvas.clientHeight,
    dpr = devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  let ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  let css = getComputedStyle(document.body);
  ctx.fillStyle = css.getPropertyValue('--bg').trim();
  ctx.fillRect(0, 0, w, h);
  let ids = [+$('x').value, +$('yaxis3').value, +$('zaxis').value],
    list = syncTime();
  let full = list.map((o) => ({
    r: o.r,
    v: ids.map((i) => (i === -1 ? o.r.index + 1 : num(o.r.row[i]))),
  }));
  let ranges = ids.map((_, i) => extent(full.map((p) => p.v[i])));
  let normalized = (v) =>
    v.map((x, i) => ((x - ranges[i][0]) / (ranges[i][1] - ranges[i][0])) * 2 - 1);
  let point3 = (v) => project3(...v, w, h);
  let line = (a, b, color) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(...point3(a));
    ctx.lineTo(...point3(b));
    ctx.stroke();
  };
  ctx.lineWidth = 1;
  let grid = viewerPrefs.grid ? css.getPropertyValue('--line').trim() : 'transparent';
  for (let i = 0; i <= 4; i++) {
    let n = -1 + i * 0.5;
    line([-1, -1, n], [1, -1, n], grid);
    line([n, -1, -1], [n, -1, 1], grid);
  }
  let colors = ['#5c80c4', '#168579', '#d89943'];
  for (let axis = 0; axis < 3; axis++) {
    let origin = [-1, -1, -1],
      tip = [...origin];
    tip[axis] = 1;
    line(origin, tip, colors[axis]);
    let p = point3(tip);
    ctx.fillStyle = colors[axis];
    ctx.font = graphFont(11, 'Segoe UI');
    ctx.fillText(
      `${'XYZ'[axis]}: ${ids[axis] === -1 ? '행 번호' : (headers[ids[axis]] ?? '미선택')}`,
      p[0] + 7,
      p[1],
    );
    for (let tick = 0; tick <= 4; tick++) {
      let q = [...origin];
      q[axis] = -1 + tick * 0.5;
      let xy = point3(q);
      ctx.font = graphFont(9, 'Consolas');
      ctx.fillText(
        fmt(ranges[axis][0] + ((ranges[axis][1] - ranges[axis][0]) * tick) / 4),
        xy[0] + 4,
        xy[1] + 13,
      );
    }
  }
  let max = $('timeMode').value === 'all' ? full.length : +$('timeSlider').value + 1,
    shown = full.slice(0, max);
  ctx.strokeStyle = '#168579';
  ctx.fillStyle = '#168579';
  ctx.lineWidth = viewerPrefs.lineWidth;
  ctx.beginPath();
  let connected = false,
    valid = 0,
    last = null;
  for (let p of shown) {
    if (!p.v.every(Number.isFinite)) {
      connected = false;
      continue;
    }
    let xy = point3(normalized(p.v));
    if ($('style').value !== 'scatter') {
      if (!connected) ctx.moveTo(...xy);
      else ctx.lineTo(...xy);
    }
    connected = true;
    last = xy;
    valid++;
  }
  if ($('style').value !== 'scatter') ctx.stroke();
  if ($('style').value !== 'line') {
    for (let p of shown) {
      if (!p.v.every(Number.isFinite)) continue;
      ctx.beginPath();
      ctx.arc(...point3(normalized(p.v)), viewerPrefs.pointSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (last) {
    ctx.fillStyle = '#d89943';
    ctx.beginPath();
    ctx.arc(...last, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!valid) {
    ctx.fillStyle = css.getPropertyValue('--muted');
    ctx.textAlign = 'center';
    ctx.fillText('유효한 X·Y·Z 데이터가 없습니다.', w / 2, h / 2);
  }
  $('extent').textContent = fmt(ranges[0][0]) + ' → ' + fmt(ranges[0][1]);
  $('plotnote').textContent =
    `3D · 유효 ${valid}점 · 왼쪽 드래그 회전 / 가운데 버튼 이동 / 휠 확대`;
}
draw = function () {
  if ($('dimension').value !== '3d') {
    if ($('timeMode').value === 'trail') {
      let full = filtered;
      filtered = ordered()
        .slice(0, +$('timeSlider').value + 1)
        .map((o) => o.r);
      try {
        originalDraw();
      } finally {
        filtered = full;
      }
    } else originalDraw();
    return;
  }
  $('plotwrap').style.height = '470px';
  panels = [];
  draw3();
};
for (let id of ['dimension', 'zaxis', 'yaxis3', 'taxis', 'timeMode'])
  $(id).onchange = () => {
    stopPlayback();
    syncTime();
    for (let id of ['xmin', 'xmax', 'ymin', 'ymax', 'applybounds'])
      $(id).disabled = $('dimension').value === '3d';
    draw();
  };
$('timeSlider').oninput = () => {
  syncTime();
  draw();
};
function stopPlayback() {
  if (playing) clearInterval(playing);
  playing = null;
  $('playtime').textContent = '▶ 재생';
}
$('playtime').onclick = () => {
  if (playing) {
    stopPlayback();
    return;
  }
  let list = ordered();
  if (!list.length) return notice('데이터를 먼저 불러오세요.');
  $('timeMode').value = 'trail';
  if (+$('timeSlider').value >= list.length - 1) $('timeSlider').value = 0;
  playing = setInterval(() => {
    let v = +$('timeSlider').value;
    if (v >= list.length - 1) {
      stopPlayback();
      return;
    }
    $('timeSlider').value = Math.min(
      list.length - 1,
      v + Math.max(1, Math.ceil(list.length / 300)),
    );
    syncTime();
    draw();
  }, 40);
  $('playtime').textContent = 'Ⅱ 일시정지';
};
// Capture 3D gestures before the 2D listeners; 2D interactions remain unchanged.
const canvas3 = $('plot');
canvas3.addEventListener(
  'pointerdown',
  (e) => {
    if ($('dimension').value !== '3d' || ![0, 1].includes(e.button)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    gesture3 = {
      x: e.clientX,
      y: e.clientY,
      yaw: angleYaw,
      pitch: anglePitch,
      offset: [...offset3],
      move: e.button === 1 || pan,
    };
    canvas3.setPointerCapture(e.pointerId);
    canvas3.style.cursor = gesture3.move ? 'grabbing' : 'move';
  },
  true,
);
canvas3.addEventListener(
  'pointermove',
  (e) => {
    if ($('dimension').value !== '3d') return;
    e.stopImmediatePropagation();
    $('tooltip').style.display = 'none';
    if (!gesture3) return;
    let dx = e.clientX - gesture3.x,
      dy = e.clientY - gesture3.y;
    if (gesture3.move) offset3 = [gesture3.offset[0] + dx, gesture3.offset[1] + dy];
    else {
      angleYaw = gesture3.yaw + dx * 0.008;
      anglePitch = Math.max(-1.5, Math.min(1.5, gesture3.pitch + dy * 0.008));
    }
    draw();
  },
  true,
);
for (let event of ['pointerup', 'pointercancel', 'lostpointercapture'])
  canvas3.addEventListener(
    event,
    (e) => {
      if ($('dimension').value !== '3d') return;
      e.stopImmediatePropagation();
      gesture3 = null;
      canvas3.style.cursor = 'crosshair';
    },
    true,
  );
canvas3.addEventListener(
  'wheel',
  (e) => {
    if ($('dimension').value !== '3d') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    scale3 = Math.max(0.15, Math.min(20, scale3 * (e.deltaY > 0 ? 1 / 1.15 : 1.15)));
    draw();
  },
  { capture: true, passive: false },
);
function resetAll() {
  angleYaw = 0.65;
  anglePitch = 0.45;
  scale3 = 1;
  offset3 = [0, 0];
  originalReset();
  draw();
}
$('reset').onclick = resetAll;
canvas3.ondblclick = resetAll;
function axisRef(id) {
  let i = +$(id).value;
  return i === -1
    ? { row: true }
    : { name: headers[i], occurrence: headers.slice(0, i).filter((h) => h === headers[i]).length };
}
function resolveRef(ref) {
  if (ref?.row) return -1;
  if (!ref || typeof ref.name !== 'string') return null;
  let matches = headers.map((h, i) => (h === ref.name ? i : -1)).filter((i) => i >= 0);
  return matches[ref.occurrence || 0] ?? null;
}
function captureTemplate() {
  return {
    format: 'atelier-csv-scope',
    version: 1,
    name: $('templateName').value.trim() || '내 그래프',
    dimension: $('dimension').value,
    x: axisRef('x'),
    y: axisRef('yaxis3'),
    z: axisRef('zaxis'),
    t: axisRef('taxis'),
    selected: [...selected].map((i) => ({
      name: headers[i],
      occurrence: headers.slice(0, i).filter((h) => h === headers[i]).length,
    })),
    selection: $('selection').value,
    layout: $('layout').value,
    style: $('style').value,
    timeMode: $('timeMode').value,
    timeIndex: +$('timeSlider').value,
    conditions: conditions.map((f) => ({
      axis: {
        name: headers[f.col],
        occurrence: headers.slice(0, f.col).filter((h) => h === headers[f.col]).length,
      },
      min: f.min,
      max: f.max,
    })),
    bounds: { x: view, y: manualY },
    camera: { yaw: angleYaw, pitch: anglePitch, scale: scale3, offset: offset3 },
  };
}
function validateTemplate(v) {
  if (
    !v ||
    v.format !== 'atelier-csv-scope' ||
    v.version !== 1 ||
    typeof v.name !== 'string' ||
    !Array.isArray(v.selected) ||
    !Array.isArray(v.conditions)
  )
    throw Error('지원하지 않는 양식 파일입니다.');
  for (let f of v.conditions)
    for (let k of ['min', 'max'])
      if (f[k] !== '' && !Number.isFinite(Number(f[k])))
        throw Error('조건 범위가 잘못된 양식입니다.');
  return v;
}
function applyTemplate(v) {
  validateTemplate(v);
  templatePending = v;
  $('templateName').value = v.name;
  if (!headers.length) {
    notice('양식을 선택했습니다. CSV를 불러오면 적용됩니다.');
    return;
  }
  stopPlayback();
  let missing = [];
  for (let [id, ref] of [
    ['x', v.x],
    ['yaxis3', v.y],
    ['zaxis', v.z],
    ['taxis', v.t],
  ]) {
    let i = resolveRef(ref);
    if (i === null) {
      missing.push(ref?.name || id);
      continue;
    }
    $(id).value = String(i);
  }
  selected = new Set(v.selected.map(resolveRef).filter((i) => i !== null && i >= 0 && numeric[i]));
  for (let ref of v.selected) if (resolveRef(ref) === null) missing.push(ref.name);
  conditions = v.conditions.flatMap((f) => {
    let i = resolveRef(f.axis);
    if (i === null) {
      missing.push(f.axis?.name);
      return [];
    }
    return [{ col: i, min: f.min, max: f.max }];
  });
  for (let [id, value] of [
    ['dimension', v.dimension],
    ['selection', v.selection],
    ['layout', v.layout],
    ['style', v.style],
    ['timeMode', v.timeMode],
  ])
    if ([...$(id).options].some((o) => o.value === value)) $(id).value = value;
  if ($('selection').value === 'single' && selected.size > 1)
    selected = new Set([[...selected][0]]);
  let range = (r) =>
    Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[0] < r[1] ? r : null;
  view = range(v.bounds?.x);
  manualY = range(v.bounds?.y);
  for (let [id, n] of [
    ['xmin', view?.[0]],
    ['xmax', view?.[1]],
    ['ymin', manualY?.[0]],
    ['ymax', manualY?.[1]],
  ])
    $(id).value = n ?? '';
  for (let id of ['xmin', 'xmax', 'ymin', 'ymax', 'applybounds'])
    $(id).disabled = $('dimension').value === '3d';
  let c = v.camera;
  if (
    c &&
    [c.yaw, c.pitch, c.scale, ...(c.offset || [])].every(Number.isFinite) &&
    c.offset?.length === 2
  ) {
    angleYaw = c.yaw;
    anglePitch = Math.max(-1.5, Math.min(1.5, c.pitch));
    scale3 = Math.max(0.15, Math.min(20, c.scale));
    offset3 = [...c.offset];
  }
  renderColumns();
  renderFilters();
  update();
  if (Number.isInteger(v.timeIndex)) {
    $('timeSlider').value = Math.max(0, Math.min(+$('timeSlider').max, v.timeIndex));
    syncTime();
    draw();
  }
  notice(
    missing.length
      ? '양식 일부 적용 · 없는 열: ' + [...new Set(missing)].join(', ')
      : '양식을 적용했습니다: ' + v.name,
  );
}
function renderTemplates() {
  let q = $('templateSearch').value.toLowerCase();
  $('templateList').innerHTML = templates
    .map((p, i) =>
      p.name.toLowerCase().includes(q)
        ? `<button class="templateItem" data-template="${i}"><b>▧ ${esc(p.name)}</b><small>${esc(p.path || '저장한 양식')}</small></button>`
        : '',
    )
    .join('');
  $('templateList')
    .querySelectorAll('[data-template]')
    .forEach((e) => (e.onclick = () => applyTemplate(templates[+e.dataset.template].data)));
}
$('saveTemplate').onclick = () => {
  if (!headers.length) return notice('CSV를 먼저 불러오세요.');
  let v = captureTemplate(),
    existing = templates.findIndex((t) => t.name === v.name);
  let entry = { name: v.name, data: v };
  if (existing >= 0) templates[existing] = entry;
  else templates.push(entry);
  renderTemplates();
  download(
    new Blob([JSON.stringify(v, null, 2)], { type: 'application/json' }),
    v.name.replace(/[\\/:*?"<>|]/g, '_') + '.json',
  );
};
async function importTemplates(files) {
  let accepted = 0,
    failed = 0;
  for (let file of files) {
    if (!file.name.toLowerCase().endsWith('.json')) continue;
    try {
      let v = validateTemplate(JSON.parse(await file.text()));
      templates.push({ name: v.name, path: file.webkitRelativePath || file.name, data: v });
      accepted++;
    } catch {
      failed++;
    }
  }
  renderTemplates();
  notice(`양식 ${accepted}개 읽음${failed ? ' · 오류 ' + failed + '개' : ''}`);
}
$('openTemplates').onclick = () => $('templateFiles').click();
$('openFolder').onclick = () => $('templateFolder').click();
$('templateFiles').onchange = (e) => importTemplates(e.target.files);
$('templateFolder').onchange = (e) => {
  templates = [];
  importTemplates(e.target.files);
};
$('templateSearch').oninput = renderTemplates;
axisOptions();
syncTime();
draw();
