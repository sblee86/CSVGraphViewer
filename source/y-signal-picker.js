// Separate pages keep the conditional editor reachable with hundreds of ordinary signals.
const ySignalPages = document.createElement('div');
ySignalPages.className = 'ySignalPages';
ySignalPages.setAttribute('role', 'tablist');
ySignalPages.setAttribute('aria-label', 'Y신호 선택 방식');
const ordinaryYPanel = document.createElement('section');
ordinaryYPanel.id = 'ordinaryYPanel';
ordinaryYPanel.setAttribute('role', 'tabpanel');
const conditionalYPanel = document.createElement('section');
conditionalYPanel.id = 'conditionalYPanel';
conditionalYPanel.setAttribute('role', 'tabpanel');
for (const element of [
  $('selection').closest('.row'),
  $('search'),
  $('all').parentElement,
  $('columns'),
])
  ordinaryYPanel.append(element);
conditionalYPanel.append(conditionalPanel);
graphSections.y.panel.append(ySignalPages, ordinaryYPanel, conditionalYPanel);
let ySignalPage = 'ordinary';
const ySignalPageEntries = [
  ['ordinary', '일반 신호 선택', ordinaryYPanel],
  ['conditional', '조건부 신호 선택', conditionalYPanel],
];
for (const [key, title, panel] of ySignalPageEntries) {
  const button = document.createElement('button');
  button.id = 'ySignalPage-' + key;
  button.type = 'button';
  button.textContent = title;
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-controls', panel.id);
  panel.setAttribute('aria-labelledby', button.id);
  button.onclick = () => showYSignalPage(key);
  ySignalPages.append(button);
}
function showYSignalPage(key) {
  ySignalPage = key;
  for (const [entry, , panel] of ySignalPageEntries) {
    const active = entry === key,
      button = $('ySignalPage-' + entry);
    panel.hidden = !active;
    button.classList.toggle('on', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }
}
ySignalPages.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const key =
    event.key === 'Home'
      ? 'ordinary'
      : event.key === 'End'
        ? 'conditional'
        : ySignalPage === 'ordinary'
          ? 'conditional'
          : 'ordinary';
  showYSignalPage(key);
  $('ySignalPage-' + key).focus();
});
const addSignalBeforePicker = addConditionalSignal;
addConditionalSignal = function (...args) {
  showYSignalPage('conditional');
  return addSignalBeforePicker(...args);
};

// Retain the selected column while narrowing the list; typing never silently changes a rule.
function attachColumnSearch(select, title) {
  if (select.previousElementSibling?.classList.contains('signalColumnSearch')) {
    select.previousElementSibling.remove();
  }
  const control = document.createElement('div');
  control.className = 'signalColumnSearch';
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = title;
  input.setAttribute('aria-label', title);
  const count = document.createElement('small');
  count.setAttribute('role', 'status');
  control.append(input, count);
  select.before(control);
  const options = [...select.options].map((option) => ({
    value: option.value,
    text: option.textContent,
  }));
  input.oninput = () => {
    const query = input.value.trim().toLocaleLowerCase(),
      current = select.value;
    const matches = options.filter((option) => option.text.toLocaleLowerCase().includes(query));
    select.replaceChildren(
      ...options
        .filter((option) => option.value === current || matches.includes(option))
        .map((option) => {
          const item = new Option(
            option.text +
              (query && option.value === current && !matches.includes(option)
                ? ' (현재 선택)'
                : ''),
            option.value,
          );
          item.selected = option.value === current;
          return item;
        }),
    );
    count.textContent = query ? matches.length + '개 검색됨 · 아래 목록에서 선택' : '';
  };
}
const renderSignalsBeforePicker = renderConditionalSignalCards;
renderConditionalSignalCards = function () {
  renderSignalsBeforePicker();
  attachColumnSearch($('conditionalYColumn'), '추가할 Y열 검색');
  $('conditionalSignalCards')
    .querySelectorAll('[data-signal-axis]')
    .forEach((select) => attachColumnSearch(select, '신호 Y열 검색'));
  $('conditionalSignalCards')
    .querySelectorAll('[data-condition-col]')
    .forEach((select) => attachColumnSearch(select, '조건 열 검색'));
};
const drawBeforeYSignalPicker = draw;
draw = function () {
  const is3d = $('dimension').value === '3d';
  ySignalPages.hidden = is3d;
  ordinaryYPanel.hidden = is3d || ySignalPage !== 'ordinary';
  conditionalYPanel.hidden = is3d || ySignalPage !== 'conditional';
  drawBeforeYSignalPicker();
};
showYSignalPage('ordinary');
renderConditionalSignalCards();
