// Capture names and workspace at button press; serialize writes to avoid collisions.
let exportWriteQueue=Promise.resolve();
function currentExportName(extension,date=new Date()){
 const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
 const col=$('dimension').value==='3d'?+$('yaxis3').value:[...selected][0],meta=columnMeta[col];
 const axis=meta?csvSources[meta.source].head[meta.local]:'데이터';
 return day+'_'+safeFileName(templatePending?.name||'양식없음').slice(0,50)+'_'+safeFileName(axis).slice(0,50)+'.'+extension;
}
download=function(blob,name,root=workRoot){
 if(!root){notice('작업폴더를 먼저 연결하세요.');return Promise.resolve()}
 const task=exportWriteQueue.then(async()=>{
  const dir=await root.getDirectoryHandle('내보내기',{create:true}),dot=name.lastIndexOf('.'),stem=safeFileName(name.slice(0,dot)),ext=name.slice(dot);
  let candidate=stem+ext,index=0;
  for(;;){try{await dir.getFileHandle(candidate);candidate=stem+'('+ ++index+')'+ext}catch(e){if(e.name==='NotFoundError')break;throw e}}
  await writeWorkspaceFile(dir,candidate,blob);notice('저장 완료: '+root.name+'/내보내기/'+candidate);return candidate;
 });
 exportWriteQueue=task.catch(e=>{notice('파일 저장 실패: '+e.message)});
 return exportWriteQueue;
};
$('export').onclick=()=>{if(!rows.length)return notice('CSV 파일을 먼저 불러오세요.');void download(new Blob([serializeCSV(headers,filtered.map(r=>r.row))],{type:'text/csv;charset=utf-8'}),currentExportName('csv'))};
$('png').onclick=()=>{
 if(!rows.length||!selected.size)return notice('데이터와 신호를 선택하세요.');if(!workRoot)return notice('작업폴더를 먼저 연결하세요.');
 const name=currentExportName('png'),root=workRoot;
 $('plot').toBlob(blob=>{if(blob)void download(blob,name,root);else notice('PNG 이미지를 만들지 못했습니다.')});
};

const helpButton=document.createElement('button');helpButton.id='viewerHelpOpen';helpButton.textContent='? 도움말';$('settingsOpen').after(helpButton);
const helpDialog=document.createElement('dialog');helpDialog.id='viewerHelp';helpDialog.setAttribute('aria-labelledby','viewerHelpTitle');
helpDialog.innerHTML=`<div class="helpTitle"><h2 id="viewerHelpTitle">CSVGraphViewer 사용법</h2><button id="viewerHelpClose" aria-label="도움말 닫기">닫기 ×</button></div>
<section><h3>1. 시작 · 데이터 탭</h3><p>데스크톱 Chrome 또는 Edge에서 작업폴더를 선택하고 읽기·쓰기 권한을 허용하세요. CSV/TSV의 첫 행은 열 이름입니다. 작업폴더와 하위폴더의 파일을 클릭하거나 체크한 뒤 ‘선택 CSV 함께 열기’를 누릅니다. ‘CSV 여러 개 추가’로 외부 파일도 열 수 있습니다.</p><p>한글이 깨지면 문자 인코딩을 CP949 / EUC-KR로 바꾸세요. 구분자는 자동 감지 또는 쉼표·세미콜론·탭을 지정합니다. 외부에서 파일을 바꾼 뒤에는 목록 새로고침을 누르세요. 열린 파일의 ×는 원본 삭제가 아니라 화면에서 제외하는 기능입니다.</p></section>
<section><h3>2. 그래프설정 → 그래프 종류</h3><p>2D는 여러 파일의 신호를 겹치거나 신호별로 나누어 비교합니다. 선·산점도·선+점을 선택할 수 있습니다. 3D는 같은 CSV의 X·Y·Z 좌표를 궤적으로 표시하며 각 축을 데이터 범위로 정규화합니다. T는 숫자 시간 열 또는 행 순서입니다. 시간 표시를 ‘현재 T까지’로 바꾸고 슬라이더나 재생을 사용하세요.</p></section>
<section><h3>3. 그래프설정 → 축 설정</h3><p>2D에서는 X열과 Y신호 체크박스를 선택합니다. 여러 파일은 각 파일의 X열을 사용하며 파일별 X축에서 따로 지정할 수 있습니다. 파일 사이 행을 합치거나 시간을 자동 보간하지 않습니다. 3D는 한 파일의 X·Y·Z를 선택하세요. 열 이름은 CSV 첫 행을 기준으로 연결합니다.</p></section>
<section><h3>4. 그래프설정 → 스케일·값 범위</h3><p>조건 필터는 열의 최소·최대에 해당하는 행만 남기며 여러 조건은 AND로 적용합니다. 여러 CSV에서는 해당 열이 속한 파일에만 적용합니다. X/Y 표시 범위를 입력한 뒤 ‘사용자 축 설정 적용’을 누르세요(2D). ‘축 범위 자동’은 자동 보기로 복원하며 입력한 사용자 범위와 조건은 유지합니다.</p></section>
<section><h3>5. 메인 그래프 조작</h3><p>‘확대’는 왼쪽 드래그로 영역을 확대하고 ‘이동’은 왼쪽 드래그로 화면을 이동합니다. 가운데 버튼 드래그는 항상 이동, 휠은 확대·축소, 더블클릭과 전체 보기는 초기 보기입니다. 3D에서 왼쪽 드래그는 회전입니다. 우클릭 메뉴로 그래프 설정에 바로 갈 수 있습니다.</p><p>전체 행은 열린 CSV의 총 레코드 수, 조건 통과 행은 그래프 조건을 통과한 수, 선택 신호는 Y신호 수입니다. X축 보기 범위는 현재 표시하는 최소·최대 X값이며 시간 재생이나 CSV 저장 행 수를 뜻하지 않습니다. 여러 파일은 각 파일의 X열 값을 공통 표시 범위에서 그립니다.</p></section>
<section><h3>6. 양식 탭</h3><p>원하는 파일·열·그래프 설정 후 이름을 적고 양식을 저장하세요. JSON은 작업폴더/양식/에 저장하며 CSV 자체는 포함하지 않습니다. 양식을 클릭하면 현재 작업폴더에서 상대 경로 또는 유일한 파일명으로 CSV를 찾아 열 이름에 맞추어 그래프를 복원합니다. 중복 파일명이나 없는 파일·열은 안내합니다.</p><p>가져오기는 외부 양식을 작업폴더에 복사합니다. 목록 새로고침으로 변경을 읽으세요. 체크박스와 ‘선택 삭제’는 선택한 양식 JSON을 실제로 삭제합니다. ‘양식 해제’는 저장 파일을 유지하고 현재 적용을 취소하여 기본 2D 분석을 시작합니다.</p></section>
<section><h3>7. 데이터 미리보기</h3><p>그래프 점을 클릭하면 원본 데이터 행과 셀을 찾아 표 내부 스크롤을 가운데로 맞춥니다. 선택 셀은 빨간색, 같은 행은 굵게·1pt 크게 표시합니다. 원본 행 번호를 유지하며 100행씩 페이지를 이동합니다.</p><p>열 제목의 ▼에서 고유값·개수 확인, 검색·체크박스 선택, 오름차순·내림차순 정렬을 사용할 수 있습니다. 여러 열 필터는 AND입니다. 이 기능은 표에만 적용하며 그래프나 CSV 내보내기는 바꾸지 않습니다. 그래프에서 선택한 행이 숨겨져 있으면 해당 행을 제외한 표 필터를 안내와 함께 해제합니다.</p></section>
<section><h3>8. PNG 저장 · CSV 내보내기</h3><p>작업폴더/내보내기/에 <b>현재날짜_양식명_축데이터명.확장자</b>로 저장합니다. 날짜는 사용 중인 PC의 현지 날짜입니다. 양식 미적용 시 ‘양식없음’, 여러 Y신호 중 첫 번째 선택 신호(3D는 Y열) 하나를 이름에 사용합니다. 같은 이름은 (1), (2)를 붙여 기존 파일을 덮어쓰지 않습니다.</p><p>PNG는 현재 그래프 이미지입니다. CSV는 그래프 조건을 통과한 행을 저장하며 표 필터·정렬, 화면 확대 범위, T 재생 구간은 CSV 저장 조건이 아닙니다. 여러 파일 CSV는 파일·열 이름을 구분하고 다른 파일의 셀은 빈 값으로 저장합니다.</p></section>
<section><h3>9. 설정 · 오프라인 사용</h3><p>설정에서 글자·아이콘·표 행 높이·요약줄 크기·테마·선·점·격자·여백을 조절합니다. 저장 및 닫기는 작업폴더에 저장하며 취소는 이전 설정으로 복원합니다. 오프라인은 CSVtoGraphViewer.html을 Chrome/Edge로 열어 사용하세요. CSV 처리는 브라우저 안에서 수행합니다.</p></section>
<footer class="helpCredits"><p>최초배포자:이상범(sangbum.lee@ligdna.com)</p><p>마음대로 수정 배포가능합니다</p></footer>`;
document.body.append(helpDialog);helpButton.onclick=()=>helpDialog.showModal();$('viewerHelpClose').onclick=()=>helpDialog.close();
function updateGraphRangeHelp(){
 const dimension=$('dimension').value,meta=columnMeta[+$('x').value],axis=meta?csvSources[meta.source].head[meta.local]:'행 번호';
 const label=$('extent').parentElement.querySelector('small');label.textContent='X축 보기 범위:';
 const explanation=dimension==='3d'?`X열 ‘${axis}’의 데이터 최소값 → 최대값입니다. 3D는 각 축을 정규화하여 그립니다.`:`X열 ‘${axis}’의 현재 표시 최소값 → 최대값입니다. 자동 범위 또는 확대·이동·사용자 축 설정이 반영됩니다. 여러 파일은 각 파일의 X열을 사용합니다.`;
 $('extent').title=explanation;$('extent').parentElement.title=explanation;
 for(const [id,text] of [['total','열린 모든 CSV의 전체 데이터 행 수입니다. 첫 행의 열 제목은 제외합니다.'],['filtered','그래프 조건 필터를 통과한 데이터 행 수입니다. 미리보기 표 필터와는 별개입니다.'],['signals','현재 그래프에서 선택한 Y신호 개수입니다.']])$(id).parentElement.title=text;
}
const drawBeforeRangeHelp=draw;draw=function(){drawBeforeRangeHelp();updateGraphRangeHelp()};updateGraphRangeHelp();
