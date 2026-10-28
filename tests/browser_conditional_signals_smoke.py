"""Exercise per-Y conditions against the four-target CFCS dataset."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import json
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(
    ('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root))
)
Thread(target=server.serve_forever, daemon=True).start()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path='/usr/bin/chromium', args=['--no-sandbox']
    )
    for entry in ['source/index.html', 'CSVtoGraphViewer.html']:
        page = browser.new_page(viewport={'width': 1500, 'height': 1000})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/{entry}')
        page.evaluate('workspaceDialog.close()')
        page.locator('#file').set_input_files(str(root / 'datasets/CFCS_105.csv'))
        page.wait_for_function('rows.length === 4800')
        range_index = page.evaluate("headers.indexOf('Range_m')")
        page.evaluate("$('none').click();openGraphSection('axes')")
        page.locator(f'#columns input[data-col="{range_index}"]').check()
        page.locator(f'#columns input[data-col="{range_index}"]').locator('..').locator('.signalQuickCondition').click()
        assert page.locator('[data-condition-value="0"]').input_value() == '1001'
        assert page.evaluate('selected.size === 1 && seriesRows([...selected][0]).length === 1200')
        for card_index, target in enumerate(['1002', '1003', '1004'], start=1):
            page.locator('.conditionalSignalCard').last.locator('[data-duplicate-signal]').click()
            card = page.locator('.conditionalSignalCard').nth(card_index)
            card.locator('[data-condition-value="0"]').fill(target)
            card.locator('[data-apply-signal]').click()
        assert page.evaluate('''() => {
          if (selected.size !== 4 || panels.length !== 1 || panels[0].series.length !== 4) return false;
          return conditionalSignals.every(signal => {
            const index = conditionalSignalMeta(signal.id), records = seriesRows(index);
            return records.length === 1200 && records.every(record =>
              csvSources[0].data[record.row._localIndex][1] === signal.conditions[0].value);
          });
        }''')
        assert all(target in page.locator('#legend').inner_text() for target in ['1001', '1002', '1003', '1004'])
        assert page.evaluate('csvSources[0].head.length === 36 && csvSources[0].data.every(row => row.length === 36)')
        assert page.evaluate("[...$('x').options].every(option => +option.value < 36) && [...$('yaxis3').options].every(option => +option.value < 36)")
        # AND a second condition onto only the fourth signal.
        card = page.locator('.conditionalSignalCard').nth(3)
        card.locator('[data-add-condition]').click()
        card.locator('[data-condition-col="1"]').select_option(str(page.evaluate("headers.indexOf('Detection')")))
        card.locator('[data-condition-value="1"]').fill('1')
        card.locator('[data-apply-signal]').click()
        assert page.evaluate('seriesRows(conditionalSignalMeta(conditionalSignals[3].id)).length === 1180')
        assert page.evaluate('seriesRows(conditionalSignalMeta(conditionalSignals[0].id)).length === 1200')
        assert '1,180' in card.locator('[data-signal-count]').inner_text()
        # Numeric and string operators stay local to each Y signal.
        card = page.locator('.conditionalSignalCard').nth(0)
        card.locator('[data-add-condition]').click()
        card.locator('[data-condition-col="1"]').select_option('0')
        card.locator('[data-condition-op="1"]').select_option('ge')
        card.locator('[data-condition-value="1"]').fill('10')
        card.locator('[data-apply-signal]').click()
        assert page.evaluate('seriesRows(conditionalSignalMeta(conditionalSignals[0].id)).length === 1100')
        card = page.locator('.conditionalSignalCard').nth(2)
        card.locator('[data-add-condition]').click()
        card.locator('[data-condition-col="1"]').select_option(str(page.evaluate("headers.indexOf('Track_State')")))
        card.locator('[data-condition-op="1"]').select_option('contains')
        card.locator('[data-condition-value="1"]').fill('CONF')
        card.locator('[data-apply-signal]').click()
        assert page.evaluate('seriesRows(conditionalSignalMeta(conditionalSignals[2].id)).length === 1196')
        # Common conditions still intersect every per-signal condition.
        page.evaluate("conditions=[{col:0,min:'30',max:'40'}];renderFilters();update()")
        assert page.evaluate('filtered.length === 404 && JSON.stringify(conditionalSignals.map(signal => seriesRows(conditionalSignalMeta(signal.id)).length)) === "[101,101,101,100]"')
        page.evaluate('conditions=[];renderFilters();update()')
        # The hover and preview hit refer to the right target's original record.
        assert page.evaluate('''() => {
          const index = conditionalSignalMeta(conditionalSignals[1].id);
          const record = seriesRows(index)[500], panel = panels[0];
          const pointXY = {
            x: panel.left + (point(record) - panel.xr[0]) / (panel.xr[1] - panel.xr[0]) * (panel.right - panel.left),
            y: panel.bottom - (num(record.row[index]) - panel.yr[0]) / (panel.yr[1] - panel.yr[0]) * (panel.bottom - panel.top),
          };
          const hit = nearestHoveredSignal(pointXY, panel), pick = nearest2DPreviewHit(pointXY);
          return columnMeta[hit.col].signalId === conditionalSignals[1].id &&
            pick.source.data[pick.localRow][1] === '1002' && pick.columns[0] === 5;
        }''')
        page.locator('#quickGraphSplit').check()
        assert page.evaluate('panels.length === 4 && panels.every(panel => panel.series.length === 1)')
        page.locator('#quickGraphSplit').uncheck()
        # Templates persist duplicate channels and their source-relative predicates.
        page.evaluate('window.savedConditionalTemplate = captureTemplate()')
        assert page.evaluate('savedConditionalTemplate.conditionalSignals.length === 4 && savedConditionalTemplate.selected.every(ref => ref.signalId)')
        page.evaluate('''async () => {
          const file = new File([csvSources[0].buffer], 'CFCS_105.csv');
          workRoot = { name: 'relocated' };
          workspaceCsv = [{ path: 'moved/CFCS_105.csv', handle: { getFile: async () => file } }];
          await openWorkspaceTemplate(savedConditionalTemplate);
          if (conditionalSignals.length !== 4 || selected.size !== 4) throw Error('Template did not restore signals');
          if (conditionalSignals.some(signal => signal.axis.file !== 'moved/CFCS_105.csv' || signal.conditions.some(condition => condition.axis.file !== signal.axis.file))) throw Error('Relative file remapping failed');
        }''')
        # Raw exports exclude virtual channels and keep original records.
        page.evaluate("window.oldDownload = download;window.rawExport = null;download = async blob => { rawExport = parseCSV(await blob.text(), 'auto') }; undefined")
        page.locator('#export').click()
        page.wait_for_function('rawExport !== null')
        assert page.evaluate('rawExport.length === 4801 && rawExport[0].length === 36 && filtered.length === 4800')
        page.evaluate('download = oldDownload;window.restoredTemplate = captureTemplate()')
        page.locator('#templateTab').click()
        page.locator('#clearCurrentTemplate').click()
        assert page.evaluate('conditionalSignals.length === 0 && headers.length === 36')
        page.evaluate('applyTemplate(restoredTemplate)')
        assert page.evaluate('conditionalSignals.length === 4 && selected.size === 4')
        # Invalid conditions fail closed instead of drawing all target rows.
        page.evaluate("conditionalSignals[0].conditions[1].value = 'invalid';refreshConditionalSignals()")
        assert page.evaluate("conditionalSignals[0].error.includes('숫자') && conditionalSignalMeta(conditionalSignals[0].id) === -1 && selected.size === 3")
        preset = json.loads((root / 'datasets/CFCS_105_4targets.json').read_text())
        page.evaluate('(preset) => openWorkspaceTemplate(preset)', preset)
        assert page.evaluate('conditionalSignals.length === 4 && selected.size === 4 && conditionalSignals.every(signal => seriesRows(conditionalSignalMeta(signal.id)).length === 1200)')
        assert not errors, errors
        print(entry, 'PASS 4 target-specific Range channels, AND/string/numeric predicates, line continuity, original row picking, split/overlay, template relocation, raw export, reset, invalid conditions')
        page.close()
    browser.close()
server.shutdown()
