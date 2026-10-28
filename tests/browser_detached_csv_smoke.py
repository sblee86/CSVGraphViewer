"""Verify the independent CSV window, tools, and safe snapshot isolation."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import csv
import io
import tempfile
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(
    ("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=str(root))
)
Thread(target=server.serve_forever, daemon=True).start()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path="/usr/bin/chromium", args=["--no-sandbox"]
    )
    for entry in ["source/index.html", "CSVtoGraphViewer.html"]:
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(f"http://127.0.0.1:{server.server_port}/{entry}")
        page.evaluate("""() => {
          workspaceDialog.close();
          const records = Array.from({ length: 220 }, (_, i) => [
            String(i), i % 2 ? 'B' : 'A', i % 2 ? '10' : '2',
            i === 205 ? 'needle' : i === 0 ? '<img src=x onerror=alert(1)>' : '한글,값',
          ]);
          csvSources = [
            parseSource(serializeCSV(['T', 'group', 'value', 'note'], records), 'first.csv'),
            parseSource('T,V\\n0,1\\n1,2', 'second.csv'),
          ];
          rebuildSources(false);
          showPreviewHit({ source: csvSources[0], localRow: 150, columns: [2] });
        }""")
        with page.context.expect_page() as opened:
            page.locator("#previewSeparateWindow").click()
        viewer = opened.value
        viewer.on("pageerror", lambda error: errors.append(str(error)))
        viewer.wait_for_selector("#grid tbody tr")
        assert viewer.locator("#files option").count() == 2
        assert viewer.locator("#grid .selected-row").get_attribute("data-row") == "150"
        assert viewer.locator("#grid img").count() == 0
        viewer.locator("#clear").click()
        viewer.locator('[data-filter="1"]').click()
        viewer.locator("#selectValues").uncheck()
        viewer.locator("#valueSearch").fill("B")
        viewer.locator("#selectValues").check()
        viewer.locator("#filterApply").click()
        assert "표시 110행" in viewer.locator("#counts").inner_text()
        viewer.locator("#next").click()
        assert viewer.locator("#grid tbody tr").count() == 10
        viewer.locator("#clear").click()
        viewer.locator('[data-filter="2"]').click()
        viewer.locator("#sortDesc").click()
        assert viewer.locator('#grid tbody tr td[data-cell="2"]').first.inner_text() == "10"
        viewer.locator("#columns summary").click()
        viewer.locator('[data-col="3"]').uncheck()
        viewer.locator("#columns summary").click()
        assert viewer.locator("#grid thead th").count() == 4
        with viewer.expect_download() as downloaded:
            viewer.locator("#saveCsv").click()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "result.csv"
            downloaded.value.save_as(path)
            records = list(csv.reader(io.StringIO(path.read_text(encoding="utf-8-sig"))))
        assert len(records) == 221 and records[0] == ['T', 'group', 'value']
        assert records[1][2] == '10'
        viewer.locator("#fontSize").fill("18")
        assert viewer.evaluate("document.body.style.getPropertyValue('--table-font')") == "18px"
        viewer.locator("#rowJump").fill("206")
        viewer.locator("#goRow").click()
        assert viewer.locator("#grid .selected-row").get_attribute("data-row") == "205"
        viewer.keyboard.press("Control+f")
        assert viewer.locator("#search").evaluate("e => e === document.activeElement")
        viewer.locator("#search").fill("needle")
        viewer.wait_for_function("document.querySelectorAll('#grid tbody tr').length === 1")
        assert viewer.locator("#grid tbody tr").get_attribute("data-row") == "205"
        assert page.evaluate("previewPicked.localRow === 150 && previewTableState(csvSources[0]).filters.size === 0 && previewTableState(csvSources[0]).sort === null")
        # Reopen reuses the independent window and refreshes its snapshot.
        pages_before = len(page.context.pages)
        page.evaluate("previewTableState(csvSources[0]).filters.set(1, new Set(['A']))")
        page.locator("#previewSeparateWindow").click()
        viewer.wait_for_function("document.querySelector('#search').value === ''")
        assert len(page.context.pages) == pages_before
        assert "표시 110행" in viewer.locator("#counts").inner_text()
        viewer.locator("#files").select_option("1")
        assert viewer.locator("#grid tbody tr").count() == 2
        assert page.evaluate("csvSources.length === 2")
        page.evaluate("""() => {
          const originalOpen = window.open;
          const originalChild = detachedCsvWindow;
          detachedCsvWindow = null;
          window.open = () => null;
          $('previewSeparateWindow').click();
          if (!$('toast').textContent.includes('차단')) throw Error('No popup-blocked feedback');
          window.open = originalOpen;
          detachedCsvWindow = originalChild;
        }""")
        # The child remains functional after the main application is closed.
        page.close()
        viewer.locator("#localFiles").set_input_files({
            "name": "local.csv", "mimeType": "text/csv",
            "buffer": '이름,값\n가,1\n나,2'.encode(),
        })
        viewer.wait_for_function("document.querySelectorAll('#files option').length === 3")
        assert viewer.locator("#grid tbody tr").count() == 2
        assert '이름' in viewer.locator("#grid thead").inner_text()
        viewer.locator("#clear").click()
        assert not errors, errors
        print(entry, "PASS separate popup, inherited selection, safe cell text, search, filters, sorting, columns, CSV export, row jump, font size, window reuse, independent local files after main closes")
        viewer.close()
        context.close()
    browser.close()
server.shutdown()
