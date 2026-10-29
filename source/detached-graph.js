// An independent numeric snapshot: zooming here never changes the main graph.
function startDetachedGraph(snapshot) {
  document.title = '신호 그래프 별도 보기';
  document.documentElement.lang = 'ko';
  document.head.innerHTML = /* HTML */ `
    <meta charset="utf-8" />
    <title>신호 그래프 별도 보기</title>
    <style>
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: #101827;
        color: #e2e8f0;
        font: 14px system-ui;
        height: 100dvh;
        display: flex;
        flex-direction: column;
      }
      header {
        padding: 12px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      button,
      select {
        padding: 8px 12px;
        background: #25354c;
        border: 1px solid #64748b;
        border-radius: 5px;
        color: inherit;
        cursor: pointer;
      }
      button.on {
        background: #215ba4;
      }
      #viewport {
        overflow: auto;
        flex: 1;
        min-height: 240px;
      }
      canvas {
        display: block;
        touch-action: none;
      }
      #note {
        padding: 8px 14px;
        white-space: pre-wrap;
      }
      #legend {
        padding: 0 14px 8px;
        overflow-wrap: anywhere;
        max-height: 15dvh;
        overflow: auto;
      }
      h1 {
        font-size: 17px;
        margin: 0 10px 0 0;
      }
    </style>
  `;
  document.body.innerHTML = /* HTML */ `
    <header>
      <h1>신호 그래프 별도 보기</h1>
      <button id="refresh">메인에서 다시 가져오기</button>
      <button id="auto">축범위 자동</button>
      <button
        id="zoom"
        class="on"
      >
        영역 확대
      </button>
      <button id="pan">이동</button>
      <button id="in">＋ 확대</button>
      <button id="out">－ 축소</button>
      <label>
        <input
          id="split"
          type="checkbox"
        />
        개별 그래프
      </label>
      <button id="png">PNG 저장</button>
    </header>
    <div id="legend"></div>
    <div id="viewport"><canvas id="graph"></canvas></div>
    <div id="note">
      휠: 확대·축소 / 드래그: 영역 확대 또는 이동 / 3D 드래그: 회전 / 두 번 클릭: 초기화
    </div>
  `;
  const $ = (id) => document.getElementById(id),
    canvas = $('graph');
  let data,
    rangeX,
    rangeY,
    panels = [],
    gesture = null,
    moving = false;
  let yaw = 0.65,
    pitch = 0.45,
    scale = 1,
    offset = [0, 0];
  let hits = [],
    saveCount = 0;
  const extent = (values) => {
    let min = Infinity,
      max = -Infinity;
    for (const value of values)
      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    if (!Number.isFinite(min)) return [0, 1];
    return min === max ? [min - 1, max + 1] : [min, max];
  };
  const format = (value) => Number(value.toPrecision(6)).toString();
  function reset() {
    rangeX = [...data.xRange];
    rangeY = data.yRange?.slice() || null;
    yaw = data.yaw;
    pitch = data.pitch;
    scale = data.scale;
    offset = [0, 0];
    draw();
  }
  window.loadGraphSnapshot = (value) => {
    data = value;
    $('split').checked = data.split;
    $('split').disabled = data.dimension === '3d';
    $('legend').replaceChildren(
      ...data.series.map((series) => {
        const label = document.createElement('span');
        label.textContent = '● ' + series.name + '  ';
        label.style.color = series.color;
        return label;
      }),
    );
    saveCount = 0;
    reset();
  };
  function draw() {
    const w = Math.max(360, $('viewport').clientWidth),
      count = data.dimension === '2d' && $('split').checked ? Math.max(1, data.series.length) : 1;
    const h = Math.max(350, $('viewport').clientHeight, count * 260),
      dpr = devicePixelRatio || 1;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#101827';
    ctx.fillRect(0, 0, w, h);
    ctx.font = '12px system-ui';
    panels = [];
    hits = [];
    if (data.dimension === '3d') {
      const ranges = [0, 1, 2].map((i) => extent(data.series[0]?.points.map((p) => p.v[i]) || []));
      const project = (v) => {
        const n = v.map(
          (value, i) => ((value - ranges[i][0]) / (ranges[i][1] - ranges[i][0])) * 2 - 1,
        );
        const a = n[0] * Math.cos(yaw) - n[2] * Math.sin(yaw),
          b = n[0] * Math.sin(yaw) + n[2] * Math.cos(yaw);
        return [
          w / 2 + a * Math.min(w, h) * 0.29 * scale + offset[0],
          h / 2 -
            (n[1] * Math.cos(pitch) - b * Math.sin(pitch)) * Math.min(w, h) * 0.29 * scale +
            offset[1],
        ];
      };
      ctx.strokeStyle = '#64748b';
      for (let i = 0; i < 3; i++) {
        const a = ranges.map((r) => r[0]),
          b = [...a];
        b[i] = ranges[i][1];
        const p = project(a),
          q = project(b);
        ctx.beginPath();
        ctx.moveTo(...p);
        ctx.lineTo(...q);
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(data.axes[i], q[0] + 5, q[1]);
      }
      for (const s of data.series) paint(s, (p) => project(p.v));
    } else {
      for (let k = 0; k < count; k++) {
        const series = $('split').checked ? [data.series[k]].filter(Boolean) : data.series;
        const yr =
          rangeY ||
          extent(
            series.flatMap((s) =>
              s.points.filter((p) => p.v[0] >= rangeX[0] && p.v[0] <= rangeX[1]).map((p) => p.v[1]),
            ),
          );
        const p = {
          left: 85,
          right: w - 25,
          top: (k * h) / count + 30,
          bottom: ((k + 1) * h) / count - 45,
          xr: rangeX,
          yr,
        };
        panels.push(p);
        const project = (v) => [
          p.left + ((v[0] - rangeX[0]) / (rangeX[1] - rangeX[0])) * (p.right - p.left),
          p.bottom - ((v[1] - yr[0]) / (yr[1] - yr[0])) * (p.bottom - p.top),
        ];
        ctx.strokeStyle = '#334155';
        ctx.fillStyle = '#cbd5e1';
        for (let t = 0; t <= 5; t++) {
          const x = p.left + ((p.right - p.left) * t) / 5,
            y = p.bottom - ((p.bottom - p.top) * t) / 5;
          ctx.beginPath();
          ctx.moveTo(x, p.top);
          ctx.lineTo(x, p.bottom);
          ctx.moveTo(p.left, y);
          ctx.lineTo(p.right, y);
          ctx.stroke();
          ctx.fillText(
            format(rangeX[0] + ((rangeX[1] - rangeX[0]) * t) / 5),
            x - 16,
            p.bottom + 20,
          );
          ctx.fillText(format(yr[0] + ((yr[1] - yr[0]) * t) / 5), 4, y + 4);
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.left, p.top, p.right - p.left, p.bottom - p.top);
        ctx.clip();
        for (const s of series) paint(s, (point) => project(point.v), p);
        ctx.restore();
      }
    }
    if (gesture?.end && !gesture.move && data.dimension === '2d') {
      const [x, y] = gesture.start,
        [endX, endY] = gesture.end;
      ctx.fillStyle = '#60a5fa33';
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, endX - x, endY - y);
      ctx.strokeRect(x, y, endX - x, endY - y);
    }
    function paint(series, project, bounds = { left: 0, right: w, top: 0, bottom: h }) {
      ctx.strokeStyle = series.color;
      ctx.fillStyle = series.color;
      ctx.lineWidth = data.lineWidth;
      let previous = null;
      for (const point of series.points) {
        if (!point.v.every(Number.isFinite)) {
          previous = null;
          continue;
        }
        const xy = project(point);
        if (previous && data.style !== 'scatter') {
          ctx.beginPath();
          ctx.moveTo(...previous);
          ctx.lineTo(...xy);
          ctx.stroke();
        }
        if (data.style !== 'line') {
          ctx.beginPath();
          ctx.arc(...xy, data.pointSize, 0, Math.PI * 2);
          ctx.fill();
        }
        if (
          xy[0] >= bounds.left &&
          xy[0] <= bounds.right &&
          xy[1] >= bounds.top &&
          xy[1] <= bounds.bottom
        )
          hits.push({ xy, point, name: series.name });
        previous = xy;
      }
    }
  }
  const position = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const panelAt = (xy) =>
    panels.find((p) => xy[0] >= p.left && xy[0] <= p.right && xy[1] >= p.top && xy[1] <= p.bottom);
  const world = (xy, p) => [
    p.xr[0] + ((xy[0] - p.left) / (p.right - p.left)) * (p.xr[1] - p.xr[0]),
    p.yr[1] - ((xy[1] - p.top) / (p.bottom - p.top)) * (p.yr[1] - p.yr[0]),
  ];
  function zoom(factor, xy) {
    if (data.dimension === '3d') scale = Math.max(0.05, Math.min(100, scale / factor));
    else {
      const p = panelAt(xy || []) || panels[0];
      if (!p) return;
      const center = xy ? world(xy, p) : [(p.xr[0] + p.xr[1]) / 2, (p.yr[0] + p.yr[1]) / 2];
      rangeX = p.xr.map((v) => center[0] + (v - center[0]) * factor);
      rangeY = p.yr.map((v) => center[1] + (v - center[1]) * factor);
    }
    draw();
  }
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2, position(e));
    },
    { passive: false },
  );
  canvas.onpointerdown = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    const xy = position(e),
      p = panelAt(xy);
    gesture = {
      id: e.pointerId,
      start: xy,
      p,
      move: moving || e.button === 1,
      x: rangeX.slice(),
      y: p?.yr.slice(),
      yaw,
      pitch,
      offset: [...offset],
    };
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = (e) => {
    const xy = position(e);
    if (gesture) {
      const g = gesture,
        dx = xy[0] - g.start[0],
        dy = xy[1] - g.start[1];
      if (data.dimension === '3d') {
        if (g.move) offset = [g.offset[0] + dx, g.offset[1] + dy];
        else {
          yaw = g.yaw + dx * 0.01;
          pitch = g.pitch + dy * 0.01;
        }
        draw();
      } else if (g.move && g.p) {
        rangeX = g.x.map((v) => v - (dx / (g.p.right - g.p.left)) * (g.x[1] - g.x[0]));
        rangeY = g.y.map((v) => v + (dy / (g.p.bottom - g.p.top)) * (g.y[1] - g.y[0]));
        draw();
      } else if (g.p) {
        g.end = xy;
        draw();
      }
      return;
    }
    let best = null,
      distance = 144;
    for (const hit of hits) {
      const d = (hit.xy[0] - xy[0]) ** 2 + (hit.xy[1] - xy[1]) ** 2;
      if (d < distance) {
        best = hit;
        distance = d;
      }
    }
    $('note').textContent = best
      ? best.name +
        ' · ' +
        best.point.v.map((v, i) => (data.axes[i] || 'Y') + ': ' + format(v)).join(' · ') +
        ' · 원본 ' +
        (best.point.row + 1) +
        '행'
      : '휠: 확대·축소 / 드래그: 영역 확대·이동 / 3D: 회전 / 두 번 클릭: 초기화';
  };
  canvas.onpointerup = (e) => {
    const g = gesture;
    if (!g) return;
    gesture = null;
    const xy = position(e);
    if (data.dimension === '2d' && !g.move && g.p && Math.abs(xy[0] - g.start[0]) > 5) {
      const a = world(g.start, g.p),
        b = world(xy, g.p);
      rangeX = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
      if (Math.abs(xy[1] - g.start[1]) > 5) rangeY = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
      draw();
    } else if (Math.hypot(xy[0] - g.start[0], xy[1] - g.start[1]) < 4) {
      let best = null,
        distance = 324;
      for (const hit of hits) {
        const d = (hit.xy[0] - xy[0]) ** 2 + (hit.xy[1] - xy[1]) ** 2;
        if (d < distance) {
          best = hit;
          distance = d;
        }
      }
      if (best) window.onGraphPick?.(best.point);
    }
  };
  canvas.onpointercancel = canvas.onlostpointercapture = () => {
    gesture = null;
    draw();
  };
  canvas.ondblclick = reset;
  $('auto').onclick = () => {
    data.xRange = extent(data.series.flatMap((s) => s.points.map((p) => p.v[0])));
    data.yRange = null;
    data.scale = 1;
    reset();
  };
  $('zoom').onclick = () => {
    moving = false;
    $('zoom').classList.add('on');
    $('pan').classList.remove('on');
  };
  $('pan').onclick = () => {
    moving = true;
    $('pan').classList.add('on');
    $('zoom').classList.remove('on');
  };
  $('in').onclick = () => zoom(1 / 1.2);
  $('out').onclick = () => zoom(1.2);
  $('split').onchange = () => {
    rangeY = null;
    draw();
  };
  $('refresh').onclick = () => window.requestGraphSnapshot?.();
  $('png').onclick = () =>
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = data.filename.replace(/\.png$/, saveCount ? '(' + saveCount + ').png' : '.png');
      saveCount++;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
  window.addEventListener('resize', draw);
  window.loadGraphSnapshot(snapshot);
}

let detachedGraphWindow = null;
function graphWindowSnapshot() {
  const is3 = $('dimension').value === '3d';
  const visible = previewVisibleRows(),
    visibleSet = new Set(visible),
    ids = is3 ? [+$('yaxis3').value] : [...selected];
  const axes = is3 ? [+$('x').value, +$('yaxis3').value, +$('zaxis').value] : [];
  return {
    dimension: is3 ? '3d' : '2d',
    split: $('layout').value === 'split',
    axes: is3 ? axes.map((i) => (i === -1 ? '행 순서' : headers[i])) : ['X', 'Y'],
    xRange: (view || dataX()).slice(),
    yRange: manualY?.slice(),
    yaw: angleYaw,
    pitch: anglePitch,
    scale: scale3,
    lineWidth: viewerPrefs.lineWidth,
    pointSize: viewerPrefs.pointSize,
    style: $('style').value,
    filename: currentExportName('png'),
    series: ids.map((col) => ({
      name: headers[col],
      color: palette[col % palette.length],
      points: (is3 ? visible : seriesRows(col).filter((r) => visibleSet.has(r))).map((r) => ({
        v: is3
          ? axes.map((i) => (i === -1 ? r.row._localIndex + 1 : num(r.row[i])))
          : [point(r), num(r.row[col])],
        sourceId: detachedSourceId(csvSources[r.row._source]),
        row: r.row._localIndex,
        columns: is3
          ? axes
              .filter((i) => columnMeta[i]?.source === r.row._source)
              .map((i) => columnMeta[i].local)
          : [columnMeta[col].local],
      })),
    })),
  };
}
const detachedGraphButton = document.createElement('button');
detachedGraphButton.id = 'graphSeparateWindow';
detachedGraphButton.textContent = '그래프 별도 창';
const detachedGraphLabel = document.createElement('span');
detachedGraphLabel.className = 'graphActionLabel';
detachedGraphLabel.append(...detachedGraphButton.childNodes);
detachedGraphButton.append(detachedGraphLabel);
$('pan').after(detachedGraphButton);
graphActionSizer.observe(detachedGraphLabel);
detachedGraphButton.onclick = () => {
  if (!rows.length) return notice('CSV 파일을 먼저 불러오세요.');
  const snapshot = graphWindowSnapshot();
  if (detachedGraphWindow && !detachedGraphWindow.closed) {
    detachedGraphWindow.loadGraphSnapshot(snapshot);
    detachedGraphWindow.focus();
    return;
  }
  const popup = window.open(
    '',
    '_blank',
    'popup,width=1200,height=800,resizable=yes,scrollbars=yes',
  );
  if (!popup) return notice('별도 창이 차단되었습니다. 이 사이트의 팝업을 허용해 주세요.');
  detachedGraphWindow = popup;
  popup.opener = null;
  popup.requestGraphSnapshot = () => {
    if (!window.closed) popup.loadGraphSnapshot(graphWindowSnapshot());
  };
  popup.onGraphPick = (point) => {
    if (window.closed) return;
    const source = csvSources.find((s) => detachedSourceId(s) === point.sourceId);
    if (source) showPreviewHit({ source, localRow: point.row, columns: point.columns });
  };
  popup.graphSnapshot = snapshot;
  const script = popup.document.createElement('script');
  script.textContent =
    '(' + startDetachedGraph.toString() + ')(window.graphSnapshot);delete window.graphSnapshot;';
  popup.document.body.append(script);
};
