// The separate viewer receives a snapshot and never edits the main graph or CSV files.
function startDetachedCsvViewer(payload) {
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  document.title = 'CSV 별도 보기';
  document.documentElement.lang = 'ko';
  document.head.innerHTML = /* HTML */ `
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width,initial-scale=1"
    />
    <title>CSV 별도 보기</title>
    <style>
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: #f5f7f8;
        color: #263339;
        font:
          13px 'Segoe UI',
          'Malgun Gothic',
          sans-serif;
        height: 100dvh;
        display: flex;
        flex-direction: column;
      }
      button,
      input,
      select {
        font: inherit;
        color: inherit;
        padding: 7px 9px;
        border: 1px solid #cbd5d9;
        border-radius: 5px;
        background: white;
        min-width: 0;
      }
      button {
        cursor: pointer;
      }
      button:hover {
        background: #e9f4f1;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      header {
        padding: 12px 16px;
        background: white;
        border-bottom: 1px solid #cbd5d9;
      }
      h1 {
        font-size: 18px;
        margin: 0 0 7px;
      }
      .toolbar {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        padding: 8px 12px;
        background: white;
        border-bottom: 1px solid #cbd5d9;
      }
      .toolbar label {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      #files {
        max-width: 320px;
      }
      #search {
        width: 210px;
      }
      #rowJump {
        width: 95px;
      }
      #fontSize {
        width: 65px;
      }
      #info {
        padding: 8px 12px;
        min-height: 35px;
      }
      #status {
        color: #146b60;
        margin-left: 10px;
      }
      #grid {
        flex: 1;
        min-height: 0;
        overflow: auto;
        background: white;
      }
      table {
        border-collapse: separate;
        border-spacing: 0;
        white-space: nowrap;
        font-size: var(--table-font, 13px);
        min-width: 100%;
      }
      td,
      th {
        border-bottom: 1px solid #dfe6e8;
        border-right: 1px solid #dfe6e8;
        padding: 8px 12px;
        text-align: right;
      }
      th {
        position: sticky;
        top: 0;
        background: #edf2f3;
        z-index: 1;
      }
      tbody tr:nth-child(even) {
        background: #f9fbfb;
      }
      tbody tr.selected-row {
        background: #fff0da;
        font-weight: 700;
      }
      tbody tr.selected-row td {
        font-size: calc(var(--table-font, 13px) + 1pt);
      }
      td.picked-cell {
        color: #e53935;
      }
      .column-filter {
        padding: 1px 5px;
        margin-left: 5px;
      }
      .active {
        color: #087f6e;
        background: #e0f4ef;
      }
      .pages {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-top: 1px solid #cbd5d9;
        background: white;
        flex-wrap: wrap;
      }
      .note {
        color: #63767d;
        font-size: 12px;
      }
      details {
        position: relative;
      }
      summary {
        cursor: pointer;
        padding: 7px;
        border: 1px solid #cbd5d9;
        border-radius: 5px;
      }
      #columnList {
        position: absolute;
        top: 100%;
        left: 0;
        min-width: 230px;
        max-height: 300px;
        overflow: auto;
        background: white;
        border: 1px solid #cbd5d9;
        z-index: 6;
        padding: 10px;
        box-shadow: 0 5px 15px #0002;
      }
      #columnList label {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 5px;
        white-space: nowrap;
      }
      #filterMenu {
        position: fixed;
        z-index: 10;
        width: min(340px, calc(100vw - 12px));
        max-height: 90dvh;
        overflow: auto;
        background: white;
        border: 1px solid #168579;
        border-radius: 6px;
        padding: 12px;
        box-shadow: 0 8px 30px #0003;
      }
      #filterMenu[hidden] {
        display: none;
      }
      .filter-actions {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
        margin: 8px 0;
      }
      #valueSearch {
        width: 100%;
        margin: 8px 0;
      }
      #valueList {
        max-height: 250px;
        overflow: auto;
        border: 1px solid #dfe6e8;
        margin: 8px 0;
      }
      #valueList label {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px;
      }
      #valueList span {
        flex: 1;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      #valueList small {
        color: #63767d;
      }
      #filterCount {
        font-size: 12px;
      }
      .empty {
        padding: 25px;
        text-align: center;
      }
    </style>
  `;
  document.body.innerHTML = /* HTML */ `
    <header>
      <h1>CSV 별도 보기</h1>
      <span class="note">
        메인에서 연 파일의 복사본입니다. 여기의 검색·필터·정렬은 그래프와 원본 파일에 영향을 주지
        않습니다.
      </span>
    </header>
    <div class="toolbar">
      <label>
        파일
        <select id="files"></select>
      </label>
      <button id="openFiles">CSV 추가 열기</button>
      <input
        id="localFiles"
        type="file"
        accept=".csv,.tsv,.txt"
        multiple
        hidden
      />
      <label>
        인코딩
        <select id="encoding">
          <option value="utf-8">UTF-8</option>
          <option value="euc-kr">CP949 / EUC-KR</option>
        </select>
      </label>
      <input
        id="search"
        type="search"
        placeholder="전체 셀 검색 (Ctrl+F)"
        aria-label="전체 셀 검색"
      />
      <button id="clear">검색·필터·정렬 초기화</button>
    </div>
    <div class="toolbar">
      <label>
        원본 행
        <input
          id="rowJump"
          type="number"
          min="1"
          placeholder="행 번호"
        />
      </label>
      <button id="goRow">행 이동</button>
      <details id="columns">
        <summary>표시할 열</summary>
        <div id="columnList"></div>
      </details>
      <label>
        글자
        <input
          id="fontSize"
          type="number"
          min="10"
          max="24"
          value="13"
        />
        px
      </label>
      <button id="copyRow">선택 행 복사</button>
      <button
        id="saveCsv"
        title="현재 검색·필터·정렬·표시 열을 반영하여 다운로드합니다."
      >
        현재 표 CSV 저장
      </button>
    </div>
    <div id="info">
      <span id="counts"></span>
      <span
        id="status"
        role="status"
      ></span>
    </div>
    <div id="grid"></div>
    <div class="pages">
      <button id="prev">이전</button>
      <span id="pageInfo"></span>
      <button id="next">다음</button>
      <label>
        페이지
        <input
          id="pageJump"
          type="number"
          min="1"
          value="1"
          style="width:75px"
        />
      </label>
      <button id="goPage">이동</button>
      <label>
        페이지당
        <select id="pageSize">
          <option>50</option>
          <option selected>100</option>
          <option>500</option>
        </select>
        행
      </label>
      <span class="note">열 제목의 ▾: 고유값·체크 필터·정렬 / 셀 클릭: 행 선택</span>
    </div>
    <div
      id="filterMenu"
      role="dialog"
      aria-label="열 값 필터와 정렬"
      hidden
    ></div>
  `;

  const $ = (id) => document.getElementById(id);
  let files = [],
    current = 0,
    page = 0,
    rowIds = [],
    editor = null,
    searchTimer = null;
  const source = () => files[current];
  const status = (message) => {
    $('status').textContent = message;
  };
  const number = (value) =>
    value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : NaN;

  function loadSnapshot(snapshot) {
    files = snapshot.files.map((file) => ({
      ...file,
      filters: new Map((file.filters || []).map(([col, values]) => [col, new Set(values)])),
      visible: new Set(file.headers.map((_, i) => i)),
      search: '',
      picked: file.picked ?? null,
      pickedColumns: file.pickedColumns || [],
    }));
    current = Math.max(0, Math.min(snapshot.current || 0, files.length - 1));
    page = 0;
    renderFiles();
    renderColumns();
    render(true);
    status('별도 창으로 불러왔습니다.');
  }
  window.loadCsvViewerSnapshot = loadSnapshot;

  function renderFiles() {
    $('files').innerHTML = files
      .map((file, i) => `<option value="${i}">${escape(file.name)}</option>`)
      .join('');
    $('files').value = String(current);
    $('search').value = source()?.search || '';
  }
  function renderColumns() {
    const file = source();
    $('columnList').innerHTML = file
      ? '<button id="allColumns">모든 열 표시</button>' +
        file.headers
          .map(
            (header, i) =>
              `<label><input type="checkbox" data-col="${i}" ${file.visible.has(i) ? 'checked' : ''}>${escape(header)}</label>`,
          )
          .join('')
      : '';
    if (!file) return;
    $('allColumns').onclick = () => {
      file.visible = new Set(file.headers.map((_, i) => i));
      renderColumns();
      render();
    };
    $('columnList')
      .querySelectorAll('input')
      .forEach(
        (input) =>
          (input.onchange = () => {
            if (input.checked) file.visible.add(+input.dataset.col);
            else file.visible.delete(+input.dataset.col);
            render();
          }),
      );
  }
  function matchingRows() {
    const file = source();
    if (!file) return [];
    const query = file.search.toLocaleLowerCase();
    const ids = file.rows
      .map((_, i) => i)
      .filter(
        (i) =>
          (!query || file.rows[i].some((value) => value.toLocaleLowerCase().includes(query))) &&
          [...file.filters].every(([col, values]) => values.has(file.rows[i][col])),
      );
    if (file.sort) {
      const { col, direction } = file.sort;
      ids.sort((a, b) => {
        const x = file.rows[a][col],
          y = file.rows[b][col];
        if (x === '' || y === '') return x === y ? a - b : x === '' ? 1 : -1;
        const nx = number(x),
          ny = number(y);
        return (
          (Number.isFinite(nx) && Number.isFinite(ny)
            ? nx - ny
            : x.localeCompare(y, 'ko', { numeric: true })) * direction || a - b
        );
      });
    }
    return ids;
  }
  function revealPicked() {
    requestAnimationFrame(() => {
      const row = $('grid').querySelector('.selected-row');
      if (!row) return;
      const outer = $('grid').getBoundingClientRect(),
        rect = row.getBoundingClientRect(),
        header = $('grid').querySelector('thead').getBoundingClientRect().height;
      $('grid').scrollTop +=
        rect.top + rect.height / 2 - outer.top - header - ($('grid').clientHeight - header) / 2;
    });
  }
  function render(reveal = false) {
    closeFilter();
    clearTimeout(searchTimer);
    const file = source(),
      size = +$('pageSize').value;
    if (!file) {
      $('grid').innerHTML = '<p class="empty">CSV 파일을 열어 주세요.</p>';
      $('saveCsv').disabled = true;
      return;
    }
    rowIds = matchingRows();
    if (reveal && file.picked !== null) {
      const index = rowIds.indexOf(file.picked);
      if (index >= 0) page = Math.floor(index / size);
    }
    const pages = Math.max(1, Math.ceil(rowIds.length / size));
    page = Math.max(0, Math.min(page, pages - 1));
    const cols = file.headers.map((_, i) => i).filter((i) => file.visible.has(i));
    $('grid').innerHTML = cols.length
      ? '<table><thead><tr><th>원본 행</th>' +
        cols
          .map(
            (col) =>
              `<th>${escape(file.headers[col])}<button class="column-filter ${file.filters.has(col) ? 'active' : ''}" data-filter="${col}" aria-label="${escape(file.headers[col])} 필터와 정렬">${file.sort?.col === col ? (file.sort.direction === 1 ? '↑' : '↓') : ''}▾</button></th>`,
          )
          .join('') +
        '</tr></thead><tbody>' +
        rowIds
          .slice(page * size, (page + 1) * size)
          .map(
            (row) =>
              `<tr data-row="${row}" ${file.picked === row ? 'class="selected-row"' : ''}><td>${row + 1}</td>` +
              cols
                .map(
                  (col) =>
                    `<td data-cell="${col}" ${file.picked === row && file.pickedColumns.includes(col) ? 'class="picked-cell"' : ''}>${escape(file.rows[row][col])}</td>`,
                )
                .join('') +
              '</tr>',
          )
          .join('') +
        '</tbody></table>'
      : '<p class="empty">표시할 열에서 한 개 이상 선택하세요.</p>';
    $('grid')
      .querySelectorAll('[data-filter]')
      .forEach((button) => (button.onclick = () => openFilter(+button.dataset.filter, button)));
    $('grid')
      .querySelectorAll('[data-row]')
      .forEach(
        (row) =>
          (row.onclick = (event) => {
            file.picked = +row.dataset.row;
            const cell = event.target.closest('[data-cell]');
            file.pickedColumns = cell ? [+cell.dataset.cell] : [];
            render();
            status('원본 ' + (file.picked + 1) + '행 선택');
          }),
      );
    $('counts').textContent =
      `${file.name} · 원본 ${file.rows.length.toLocaleString()}행 · 표시 ${rowIds.length.toLocaleString()}행 · ${cols.length}/${file.headers.length}열`;
    $('pageInfo').textContent =
      `${rowIds.length ? page * size + 1 : 0}–${Math.min((page + 1) * size, rowIds.length)} / ${rowIds.length.toLocaleString()}행 · ${page + 1}/${pages}쪽`;
    $('pageJump').max = String(pages);
    $('pageJump').value = String(page + 1);
    $('rowJump').max = String(file.rows.length);
    $('prev').disabled = page === 0;
    $('next').disabled = page >= pages - 1;
    $('copyRow').disabled = !cols.length || file.picked === null || !rowIds.includes(file.picked);
    $('saveCsv').disabled = !cols.length;
    if (reveal) revealPicked();
  }

  function closeFilter() {
    editor = null;
    $('filterMenu').hidden = true;
  }
  function paintValues() {
    if (!editor) return;
    const query = $('valueSearch').value.toLocaleLowerCase();
    editor.matches = editor.values.filter(([value]) => value.toLocaleLowerCase().includes(query));
    $('valueList').innerHTML =
      editor.matches
        .slice(0, editor.limit)
        .map(
          ([value, count]) =>
            `<label><input type="checkbox" data-value="${editor.indices.get(value)}" ${editor.checked.has(value) ? 'checked' : ''}><span>${escape(value === '' ? '(빈 셀)' : value)}</span><small>${count}개</small></label>`,
        )
        .join('') || '<p>검색 결과 없음</p>';
    $('valueList')
      .querySelectorAll('input')
      .forEach(
        (box) =>
          (box.onchange = () => {
            const value = editor.values[+box.dataset.value][0];
            if (box.checked) editor.checked.add(value);
            else editor.checked.delete(value);
            updateCount();
          }),
      );
    $('moreValues').hidden = editor.limit >= editor.matches.length;
    updateCount();
  }
  function updateCount() {
    $('filterCount').textContent =
      `고유값 ${editor.values.length}개 · 선택 ${editor.checked.size}개 · 검색 ${editor.matches.length}개`;
    const count = editor.matches.filter(([value]) => editor.checked.has(value)).length;
    $('selectValues').checked = !!editor.matches.length && count === editor.matches.length;
    $('selectValues').indeterminate = count > 0 && count < editor.matches.length;
  }
  function openFilter(col, button) {
    const file = source(),
      counts = new Map();
    for (const row of file.rows) counts.set(row[col], (counts.get(row[col]) || 0) + 1);
    const values = [...counts].sort((a, b) => a[0].localeCompare(b[0], 'ko', { numeric: true }));
    editor = {
      col,
      values,
      indices: new Map(values.map(([value], i) => [value, i])),
      checked: new Set(file.filters.get(col) || counts.keys()),
      matches: values,
      limit: 200,
    };
    $('filterMenu').innerHTML =
      `<b>${escape(file.headers[col])}</b><div class="filter-actions"><button id="sortAsc">↑ 오름차순</button><button id="sortDesc">↓ 내림차순</button><button id="sortClear">정렬 해제</button></div><input id="valueSearch" placeholder="값 검색" aria-label="열 값 검색"><label><input id="selectValues" type="checkbox">검색 값 전체 선택 / 해제</label><p id="filterCount"></p><div id="valueList"></div><button id="moreValues">값 더 보기</button><div class="filter-actions"><button id="filterClear">이 열 해제</button><button id="filterCancel">취소</button><button id="filterApply">적용</button></div>`;
    for (const [id, direction] of [
      ['sortAsc', 1],
      ['sortDesc', -1],
      ['sortClear', 0],
    ])
      $(id).onclick = () => {
        file.sort = direction ? { col, direction } : null;
        page = 0;
        render();
      };
    $('valueSearch').oninput = () => {
      editor.limit = 200;
      paintValues();
    };
    $('selectValues').onchange = () => {
      for (const [value] of editor.matches)
        if ($('selectValues').checked) editor.checked.add(value);
        else editor.checked.delete(value);
      paintValues();
    };
    $('moreValues').onclick = () => {
      editor.limit += 200;
      paintValues();
    };
    $('filterClear').onclick = () => {
      file.filters.delete(col);
      page = 0;
      render();
    };
    $('filterCancel').onclick = closeFilter;
    $('filterApply').onclick = () => {
      if (editor.checked.size === editor.values.length) file.filters.delete(col);
      else file.filters.set(col, new Set(editor.checked));
      page = 0;
      render();
    };
    $('filterMenu').hidden = false;
    paintValues();
    const rect = button.getBoundingClientRect(),
      menu = $('filterMenu');
    menu.style.left = Math.max(6, Math.min(rect.left, innerWidth - menu.offsetWidth - 6)) + 'px';
    menu.style.top =
      Math.max(6, Math.min(rect.bottom + 4, innerHeight - menu.offsetHeight - 6)) + 'px';
    $('valueSearch').focus({ preventScroll: true });
  }

  $('files').onchange = () => {
    current = +$('files').value;
    page = 0;
    $('search').value = source().search;
    renderColumns();
    render(true);
  };
  $('search').oninput = () => {
    source().search = $('search').value;
    page = 0;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => render(), 150);
  };
  $('clear').onclick = () => {
    const file = source();
    file.filters.clear();
    file.sort = null;
    file.search = '';
    $('search').value = '';
    page = 0;
    render();
    status('검색·필터·정렬 초기화');
  };
  $('prev').onclick = () => {
    page--;
    render();
    $('grid').scrollTop = 0;
  };
  $('next').onclick = () => {
    page++;
    render();
    $('grid').scrollTop = 0;
  };
  $('pageSize').onchange = () => {
    page = 0;
    render();
  };
  $('goPage').onclick = () => {
    const value = +$('pageJump').value;
    if (Number.isInteger(value) && value >= 1) {
      page = value - 1;
      render();
      $('grid').scrollTop = 0;
    }
  };
  $('pageJump').onkeydown = (event) => {
    if (event.key === 'Enter') $('goPage').click();
  };
  $('goRow').onclick = () => {
    const value = +$('rowJump').value,
      file = source();
    if (!Number.isInteger(value) || value < 1 || value > file.rows.length)
      return status('원본 데이터 행 번호를 입력하세요.');
    if (!matchingRows().includes(value - 1))
      return status('해당 행은 검색·필터로 숨겨져 있습니다. 초기화 후 이동하세요.');
    file.picked = value - 1;
    file.pickedColumns = [];
    render(true);
    status('원본 ' + value + '행으로 이동');
  };
  $('rowJump').onkeydown = (event) => {
    if (event.key === 'Enter') $('goRow').click();
  };
  $('fontSize').oninput = () => {
    const value = +$('fontSize').value;
    if (value >= 10 && value <= 24) document.body.style.setProperty('--table-font', value + 'px');
  };
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      $('search').focus();
    }
    if (event.key === 'Escape') closeFilter();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!$('filterMenu').contains(event.target) && !event.target.closest('[data-filter]'))
      closeFilter();
    if (!$('columns').contains(event.target)) $('columns').open = false;
  });
  window.addEventListener('resize', closeFilter);
  $('grid').addEventListener('scroll', closeFilter);
  $('saveCsv').onclick = () => {
    const file = source(),
      cols = file.headers.map((_, i) => i).filter((i) => file.visible.has(i));
    const csv = serializeCSV(
      cols.map((col) => file.headers[col]),
      matchingRows().map((row) => cols.map((col) => file.rows[row][col])),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })),
      link = document.createElement('a');
    link.href = url;
    link.download =
      file.name
        .split('/')
        .pop()
        .replace(/\.[^.]+$/, '') + '_표보기.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    status('현재 표를 CSV로 다운로드했습니다. 원본은 변경하지 않았습니다.');
  };
  $('copyRow').onclick = async () => {
    const file = source();
    if (file.picked === null) return;
    const quote = (value) =>
      /[\t\r\n"]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
    const text = file.rows[file.picked]
      .filter((_, col) => file.visible.has(col))
      .map(quote)
      .join('\t');
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const input = document.createElement('textarea');
        input.value = text;
        document.body.append(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw Error('복사 권한이 없습니다.');
      }
      status('선택 행을 복사했습니다.');
    } catch {
      status('복사하지 못했습니다. 표에서 값을 선택해 Ctrl+C로 복사하세요.');
    }
  };
  $('openFiles').onclick = () => $('localFiles').click();
  $('localFiles').onchange = async (event) => {
    const entries = [...event.target.files];
    event.target.value = '';
    let added = 0,
      failed = 0;
    for (const file of entries) {
      try {
        const parsed = parseCSV(
          new TextDecoder($('encoding').value).decode(await file.arrayBuffer()),
          'auto',
        );
        if (parsed.length < 2 || parsed.some((row) => row.length !== parsed[0].length))
          throw Error('CSV 형식 오류');
        const headers = parsed.shift();
        files.push({
          name: file.name,
          headers,
          rows: parsed,
          filters: new Map(),
          sort: null,
          visible: new Set(headers.map((_, i) => i)),
          search: '',
          picked: null,
          pickedColumns: [],
        });
        added++;
      } catch {
        failed++;
      }
    }
    if (added) {
      current = files.length - 1;
      page = 0;
      renderFiles();
      renderColumns();
      render();
    }
    status(`추가 ${added}개` + (failed ? ` · 읽기 실패 ${failed}개` : ''));
  };
  loadSnapshot(payload);
  payload = null;
  delete window.csvViewerPayload;
}

let detachedCsvWindow = null;
const detachedCsvButton = document.createElement('button');
detachedCsvButton.id = 'previewSeparateWindow';
detachedCsvButton.type = 'button';
detachedCsvButton.textContent = '별도 창으로 보기';
detachedCsvButton.title = 'CSV 전용 창에서 검색·필터·정렬·열 선택 도구로 봅니다.';
previewPin.before(detachedCsvButton);
detachedCsvButton.onclick = (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!csvSources.length) return notice('CSV 파일을 먼저 불러오세요.');
  const payload = {
    current: Math.max(0, csvSources.indexOf(previewSource)),
    files: csvSources.map((source) => {
      const state = previewTableState(source);
      return {
        name: sourceLabel(source),
        headers: [...source.head],
        rows: source.data.map((row) => [...row]),
        filters: [...state.filters].map(([col, values]) => [col, [...values]]),
        sort: state.sort ? { ...state.sort } : null,
        picked:
          validPreviewPick(previewPicked) && previewPicked.source === source
            ? previewPicked.localRow
            : null,
        pickedColumns:
          validPreviewPick(previewPicked) && previewPicked.source === source
            ? [...previewPicked.columns]
            : [],
      };
    }),
  };
  if (detachedCsvWindow && !detachedCsvWindow.closed && detachedCsvWindow.loadCsvViewerSnapshot) {
    detachedCsvWindow.loadCsvViewerSnapshot(payload);
    detachedCsvWindow.focus();
    return;
  }
  const popup = window.open(
    '',
    '_blank',
    'popup,width=1200,height=800,resizable=yes,scrollbars=yes',
  );
  if (!popup)
    return notice('별도 창이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.');
  detachedCsvWindow = popup;
  popup.opener = null;
  popup.csvViewerPayload = payload;
  const script = popup.document.createElement('script');
  script.textContent =
    'const parseCSV = ' +
    parseCSV.toString() +
    ';\nconst serializeCSV = ' +
    serializeCSV.toString() +
    ';\n(' +
    startDetachedCsvViewer.toString() +
    ')(window.csvViewerPayload);';
  popup.document.body.append(script);
};
