// Conditional Y channels are plot-only aliases. Original CSV records remain untouched.
let conditionalSignals = [],
  conditionalSignalRoot = workRoot,
  conditionalSignalSerial = 0;
const conditionalOperators = {
  eq: '=',
  ne: '≠',
  gt: '>',
  ge: '≥',
  lt: '<',
  le: '≤',
  contains: '포함',
};
const baseColumnRef = columnRef,
  baseFindColumn = findColumn;
function localColumnForRef(source, ref) {
  if (!source || ref?.file !== source.path) return null;
  const matches = source.head
    .map((name, index) => (name === ref.column ? index : -1))
    .filter((index) => index >= 0);
  return matches[ref.occurrence || 0] ?? null;
}
function conditionalSignalMeta(id) {
  return columnMeta.findIndex((meta) => meta.signalId === id);
}
columnRef = function (index) {
  const ref = baseColumnRef(index);
  return ref && columnMeta[index]?.signalId
    ? { ...ref, signalId: columnMeta[index].signalId }
    : ref;
};
findColumn = function (ref) {
  if (ref?.signalId) {
    const index = conditionalSignalMeta(ref.signalId);
    return index < 0 ? null : index;
  }
  return baseFindColumn(ref);
};
resolveRef = findColumn;
window.isConditionalSignalIndex = (index) => !!columnMeta[index]?.signalId;
window.hasConditionalSignalsForFile = (path) =>
  conditionalSignals.some((signal) => signal.axis.file === path);
function signalConditionMatches(value, condition) {
  const expected = String(condition.value ?? ''),
    left = num(value),
    right = num(expected);
  if (condition.operator === 'contains') return String(value).includes(expected);
  const equal =
    Number.isFinite(left) && Number.isFinite(right) ? left === right : String(value) === expected;
  if (condition.operator === 'eq') return equal;
  if (condition.operator === 'ne') return !equal;
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return condition.operator === 'gt'
    ? left > right
    : condition.operator === 'ge'
      ? left >= right
      : condition.operator === 'lt'
        ? left < right
        : left <= right;
}
function signalDescription(signal) {
  const conditions = signal.conditions.map(
    (condition) =>
      `${condition.axis.column} ${conditionalOperators[condition.operator]} ${condition.value === '' ? '(빈 값)' : condition.value}`,
  );
  return (
    signal.axis.file +
    ' / ' +
    signal.axis.column +
    (conditions.length ? ' · ' + conditions.join(' AND ') : ' · 조건 없음')
  );
}
function compileConditionalSignal(signal) {
  const sourceIndex = csvSources.findIndex((source) => source.path === signal.axis.file),
    source = csvSources[sourceIndex],
    local = localColumnForRef(source, signal.axis);
  if (local === null || !source.numeric[local])
    return { error: 'Y열 또는 파일을 찾을 수 없습니다.' };
  const predicates = signal.conditions.map((condition) => ({
    local: localColumnForRef(source, condition.axis),
    condition: { ...condition },
  }));
  if (predicates.some((entry) => entry.local === null))
    return { error: '조건 열을 찾을 수 없습니다. 조건 열을 다시 선택하세요.' };
  if (
    predicates.some(
      ({ condition }) =>
        !['eq', 'ne', 'contains'].includes(condition.operator) &&
        !Number.isFinite(num(condition.value)),
    )
  )
    return { error: '크기 비교 조건에는 숫자 값을 입력하세요.' };
  const acceptsLocal = (row) =>
    predicates.every((entry) => signalConditionMatches(row[entry.local], entry.condition));
  return { sourceIndex, source, local, acceptsLocal };
}
window.installConditionalSignals = function () {
  if (conditionalSignalRoot !== workRoot) {
    conditionalSignals = [];
    conditionalSignalRoot = workRoot;
  }
  const baseCount = csvSources.reduce((count, source) => count + source.head.length, 0);
  headers.length = baseCount;
  numeric.length = baseCount;
  columnMeta.length = baseCount;
  for (const row of rows) row.length = baseCount;
  for (const signal of conditionalSignals) {
    const compiled = compileConditionalSignal(signal);
    signal.error = compiled.error || '';
    if (compiled.error) continue;
    const index = headers.length;
    headers.push(signalDescription(signal));
    numeric.push(true);
    const acceptRow = (row) =>
      row._source === compiled.sourceIndex &&
      compiled.acceptsLocal(compiled.source.data[row._localIndex]);
    columnMeta.push({
      source: compiled.sourceIndex,
      local: compiled.local,
      signalId: signal.id,
      acceptRow,
    });
    for (const row of rows)
      row[index] = acceptRow(row) ? compiled.source.data[row._localIndex][compiled.local] : '';
  }
};
window.selectConditionalSignals = function (prior) {
  if (prior.length) return;
  const files = new Set(conditionalSignals.map((signal) => signal.axis.file));
  for (const index of selected) {
    const meta = columnMeta[index];
    if (meta && !meta.signalId && files.has(csvSources[meta.source].path)) selected.delete(index);
  }
  for (const signal of conditionalSignals.filter((entry) => entry.enabled)) {
    const index = conditionalSignalMeta(signal.id);
    if (index >= 0) selected.add(index);
  }
};
function rememberSignalSelection() {
  for (const signal of conditionalSignals) {
    const index = conditionalSignalMeta(signal.id);
    if (index >= 0) signal.enabled = selected.has(index);
  }
}
function refreshConditionalSignals() {
  const refs = [...selected].map(columnRef).filter(Boolean);
  window.installConditionalSignals();
  selected = new Set(
    refs.map(findColumn).filter((index) => index !== null && index >= 0 && numeric[index]),
  );
  for (const signal of conditionalSignals) {
    const index = conditionalSignalMeta(signal.id);
    if (index >= 0) {
      if (signal.enabled) selected.add(index);
      else selected.delete(index);
    }
  }
  renderColumns();
  renderFilters();
  update();
}
const seriesRowsBeforeConditions = seriesRows;
seriesRows = function (col) {
  const meta = columnMeta[col];
  return meta?.acceptRow
    ? filtered.filter((entry) => meta.acceptRow(entry.row))
    : seriesRowsBeforeConditions(col);
};

const conditionalPanel = document.createElement('section');
conditionalPanel.id = 'conditionalSignalsPanel';
conditionalPanel.innerHTML = `<div class="panelhead">조건별 Y신호</div><p class="help">같은 Y열도 조건별로 여러 번 그릴 수 있습니다. 예: Range_m / Target_ID = 1001, Range_m / Target_ID = 1002. 한 신호의 여러 조건은 AND입니다.</p><div class="conditionalAdd"><select id="conditionalYColumn" aria-label="조건별 Y열"></select><button id="addConditionalSignal" class="sidebarAction">조건부 Y신호 추가</button></div><div id="conditionalSignalCards"></div>`;
graphSections.y.panel.append(conditionalPanel);
function newSignalId() {
  return 'signal-' + Date.now().toString(36) + '-' + ++conditionalSignalSerial;
}
function defaultSignalCondition(source) {
  const local = source.head.findIndex((name) =>
    /target[_ ]?(id|number|no)|track[_ ]?id|표적번호/i.test(name),
  );
  if (local < 0) return null;
  const values = [...new Set(source.data.map((row) => row[local]))].sort((a, b) =>
    a.localeCompare(b, 'ko', { numeric: true }),
  );
  return {
    axis: sourceColumnRef(source, local),
    operator: 'eq',
    value: values.find((value) => value !== '') || '',
  };
}
function addConditionalSignal(index, copy = null) {
  rememberSignalSelection();
  const meta = columnMeta[index];
  if (!meta) return;
  const source = csvSources[meta.source],
    firstCondition = defaultSignalCondition(source);
  const signal = copy
    ? JSON.parse(JSON.stringify(copy))
    : {
        axis: sourceColumnRef(source, meta.local),
        conditions: firstCondition ? [firstCondition] : [],
      };
  signal.id = newSignalId();
  signal.enabled = true;
  delete signal.error;
  conditionalSignals.push(signal);
  selected.delete(index);
  $('selection').value = 'multi';
  view = null;
  refreshConditionalSignals();
  requestAnimationFrame(() => {
    const card = $('conditionalSignalCards').querySelector(
      `[data-signal-card="${conditionalSignals.indexOf(signal)}"]`,
    );
    if (card?.offsetParent)
      sidebar.scrollTop +=
        card.getBoundingClientRect().top - sidebar.getBoundingClientRect().top - 16;
  });
}
function renderConditionalSignalCards() {
  const old = $('conditionalYColumn').value;
  $('conditionalYColumn').innerHTML = headers
    .map((name, index) =>
      numeric[index] && !columnMeta[index]?.signalId
        ? `<option value="${index}">${esc(name)}</option>`
        : '',
    )
    .join('');
  if ([...$('conditionalYColumn').options].some((option) => option.value === old))
    $('conditionalYColumn').value = old;
  else {
    const first = [...selected].find((index) => !columnMeta[index]?.signalId);
    if (first !== undefined) $('conditionalYColumn').value = String(first);
  }
  $('addConditionalSignal').disabled = !$('conditionalYColumn').options.length;
  $('conditionalSignalCards').innerHTML = conditionalSignals
    .map((signal, index) => {
      const source = csvSources.find((entry) => entry.path === signal.axis.file),
        current = localColumnForRef(source, signal.axis);
      const options = source
        ? source.head
            .map((name, local) =>
              source.numeric[local]
                ? `<option value="${local}" ${local === current ? 'selected' : ''}>${esc(name)}</option>`
                : '',
            )
            .join('')
        : '';
      const conditions = signal.conditions
        .map((condition, ci) => {
          const local = localColumnForRef(source, condition.axis),
            values =
              local === null
                ? []
                : [...new Set(source.data.map((row) => row[local]))]
                    .sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }))
                    .slice(0, 200);
          return `<div class="signalCondition"><select data-condition-col="${ci}" aria-label="조건 열">${local === null ? '<option value="-1">조건 열 없음</option>' : ''}${source ? source.head.map((name, i) => `<option value="${i}" ${i === local ? 'selected' : ''}>${esc(name)}</option>`).join('') : ''}</select><select data-condition-op="${ci}" aria-label="조건 연산자">${Object.entries(
            conditionalOperators,
          )
            .map(
              ([op, name]) =>
                `<option value="${op}" ${op === condition.operator ? 'selected' : ''}>${name}</option>`,
            )
            .join(
              '',
            )}</select><input data-condition-value="${ci}" aria-label="조건 값" value="${esc(condition.value)}" list="conditionValues-${index}-${ci}" placeholder="예: 1001"><datalist id="conditionValues-${index}-${ci}">${values.map((value) => `<option value="${esc(value)}"></option>`).join('')}</datalist><button data-remove-condition="${ci}" aria-label="조건 제거">×</button></div>`;
        })
        .join('');
      return `<article class="conditionalSignalCard" data-signal-card="${index}"><div class="conditionalCardHeading"><label><input type="checkbox" data-enable-signal ${signal.enabled ? 'checked' : ''}>사용</label><button data-duplicate-signal>복제</button><button data-remove-signal>제거</button></div><small>${esc(signal.axis.file)}</small><label>Y열 <select data-signal-axis aria-label="신호 Y열">${current === null ? '<option value="-1">Y열 없음</option>' : ''}${options}</select></label>${conditions}<div class="conditionalCardActions"><button data-add-condition>＋ 조건 추가</button><button data-apply-signal class="sidebarAction">적용</button></div><p data-signal-count class="help"></p><p class="signalConditionError" role="status">${esc(signal.error || '')}</p></article>`;
    })
    .join('');
  $('conditionalSignalCards')
    .querySelectorAll('[data-signal-card]')
    .forEach((card) => {
      const signal = conditionalSignals[+card.dataset.signalCard],
        source = csvSources.find((entry) => entry.path === signal.axis.file);
      card.querySelector('[data-enable-signal]').onchange = (event) => {
        signal.enabled = event.target.checked;
        refreshConditionalSignals();
      };
      card.querySelector('[data-remove-signal]').onclick = () => {
        rememberSignalSelection();
        conditionalSignals = conditionalSignals.filter((entry) => entry !== signal);
        refreshConditionalSignals();
      };
      card.querySelector('[data-duplicate-signal]').onclick = () => {
        const index = conditionalSignalMeta(signal.id);
        if (index >= 0) addConditionalSignal(index, signal);
      };
      card.querySelector('[data-signal-axis]').onchange = (event) => {
        if (source && +event.target.value >= 0) {
          signal.axis = sourceColumnRef(source, +event.target.value);
          refreshConditionalSignals();
        }
      };
      card.querySelector('[data-add-condition]').onclick = () => {
        if (!source) return;
        signal.conditions.push(
          defaultSignalCondition(source) || {
            axis: sourceColumnRef(source, 0),
            operator: 'eq',
            value: source.data[0]?.[0] || '',
          },
        );
        renderConditionalSignalCards();
      };
      card.querySelectorAll('[data-condition-col]').forEach(
        (input) =>
          (input.onchange = () => {
            if (source && +input.value >= 0) {
              signal.conditions[+input.dataset.conditionCol].axis = sourceColumnRef(
                source,
                +input.value,
              );
              renderConditionalSignalCards();
            }
          }),
      );
      card.querySelectorAll('[data-condition-op]').forEach(
        (input) =>
          (input.onchange = () => {
            signal.conditions[+input.dataset.conditionOp].operator = input.value;
          }),
      );
      card.querySelectorAll('[data-condition-value]').forEach(
        (input) =>
          (input.oninput = () => {
            signal.conditions[+input.dataset.conditionValue].value = input.value;
          }),
      );
      card.querySelectorAll('[data-remove-condition]').forEach(
        (button) =>
          (button.onclick = () => {
            signal.conditions.splice(+button.dataset.removeCondition, 1);
            renderConditionalSignalCards();
          }),
      );
      card.querySelector('[data-apply-signal]').onclick = () => {
        rememberSignalSelection();
        view = null;
        refreshConditionalSignals();
      };
    });
  conditionalPanel.hidden = $('dimension').value === '3d';
}
$('addConditionalSignal').onclick = () => addConditionalSignal(+$('conditionalYColumn').value);
const renderColumnsBeforeConditionalSignals = renderColumns;
renderColumns = function () {
  rememberSignalSelection();
  renderColumnsBeforeConditionalSignals();
  $('columns')
    .querySelectorAll('input[data-col]')
    .forEach((input) => {
      if (!numeric[+input.dataset.col]) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'signalQuickCondition';
      button.textContent = '조건';
      button.title = '이 Y열을 조건별 신호로 추가합니다.';
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        addConditionalSignal(+input.dataset.col);
      };
      input.closest('label').append(button);
    });
  renderConditionalSignalCards();
};

function cleanConditionalDefinitions(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw Error('조건별 Y신호 형식이 잘못되었습니다.');
  const ids = new Set();
  return value.map((signal) => {
    if (
      !signal ||
      typeof signal.id !== 'string' ||
      ids.has(signal.id) ||
      !signal.axis ||
      typeof signal.axis.file !== 'string' ||
      typeof signal.axis.column !== 'string' ||
      !Array.isArray(signal.conditions)
    )
      throw Error('조건별 Y신호 정보가 잘못되었습니다.');
    ids.add(signal.id);
    return {
      id: signal.id,
      axis: { ...signal.axis },
      enabled: signal.enabled !== false,
      conditions: signal.conditions.map((condition) => {
        if (
          !condition?.axis ||
          typeof condition.axis.file !== 'string' ||
          typeof condition.axis.column !== 'string' ||
          !Object.hasOwn(conditionalOperators, condition.operator)
        )
          throw Error('Y신호의 조건 열 또는 연산자가 잘못되었습니다.');
        return {
          axis: { ...condition.axis },
          operator: condition.operator,
          value: String(condition.value ?? ''),
        };
      }),
    };
  });
}
const captureBeforeConditionalSignals = captureTemplate;
captureTemplate = function () {
  rememberSignalSelection();
  refreshConditionalSignals();
  const value = captureBeforeConditionalSignals();
  value.conditionalSignals = cleanConditionalDefinitions(conditionalSignals);
  return value;
};
const applyBeforeConditionalSignals = applyTemplate;
applyTemplate = function (value) {
  conditionalSignals = cleanConditionalDefinitions(value.conditionalSignals);
  conditionalSignalRoot = workRoot;
  window.installConditionalSignals();
  applyBeforeConditionalSignals(value);
  rememberSignalSelection();
  renderColumns();
};
function updateConditionalSignalCounts() {
  $('conditionalSignalCards')
    .querySelectorAll('[data-signal-card]')
    .forEach((card) => {
      const signal = conditionalSignals[+card.dataset.signalCard],
        index = conditionalSignalMeta(signal.id);
      const records = index < 0 ? [] : seriesRows(index);
      const count = records.filter((record) => Number.isFinite(num(record.row[index]))).length;
      card.querySelector('[data-signal-count]').textContent =
        `조건 통과 ${records.length.toLocaleString()}행 · 유효 값 ${count.toLocaleString()}개`;
    });
}
const updateBeforeConditionalSignals = update;
update = function () {
  updateBeforeConditionalSignals();
  const count = csvSources.reduce((sum, source) => sum + source.head.length, 0);
  $('colcount').textContent = count;
  $('dataSummary').textContent = `${count} 열 / ${filtered.length.toLocaleString()} 행`;
  $('filesub').textContent = `${rows.length.toLocaleString()}행 · ${count}열 (파일별 독립 X축)`;
  if (conditionalSignals.length)
    $('status').textContent += ` · 조건별 Y신호 ${conditionalSignals.length}개`;
  updateConditionalSignalCounts();
};
const drawBeforeConditionalSignals = draw;
draw = function () {
  rememberSignalSelection();
  conditionalPanel.hidden = $('dimension').value === '3d';
  drawBeforeConditionalSignals();
  $('filtered').parentElement.title =
    '파일 공통 조건을 통과한 행 수입니다. 신호별 조건 통과 행 수는 조건별 Y신호 카드와 통계에서 확인하세요.';
  $('conditionalSignalCards')
    .querySelectorAll('[data-enable-signal]')
    .forEach((box, index) => {
      box.checked = conditionalSignals[index].enabled;
    });
  updateConditionalSignalCounts();
};
const clearTemplateBeforeConditionalSignals = clearTemplateButton.onclick;
clearTemplateButton.onclick = () => {
  conditionalSignals = [];
  clearTemplateBeforeConditionalSignals();
};
const clearFilesBeforeConditionalSignals = $('clearLoadedCsv').onclick;
$('clearLoadedCsv').onclick = () => {
  conditionalSignals = [];
  clearFilesBeforeConditionalSignals();
};
renderColumns();

const commonConditionHeading = analysisControls.querySelector('.panelhead');
if (commonConditionHeading?.firstChild)
  commonConditionHeading.firstChild.textContent = '파일 공통 조건 ';
