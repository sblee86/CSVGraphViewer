"""Exercise modeless help/settings, local zoom, and the saved tab divider."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
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
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(f"http://127.0.0.1:{server.server_port}/{entry}")
        page.evaluate("""() => {
          workspaceDialog.close();
          load('T,X,Y,Z\\n0,1,2,3\\n1,2,3,4', 'records.csv');
          window.settingsText = '';
          workRoot = {
            getFileHandle: async () => ({
              createWritable: async () => ({
                write: async text => { settingsText = text; },
                close: async () => {},
              }),
              getFile: async () => ({ text: async () => settingsText }),
            }),
          };
          openGraphSection('range');
        }""")
        assert page.locator("#graphPanel > .panelhead").count() == 0
        divider = page.locator("#graphTabDivider")
        divider.focus()
        page.keyboard.press("ArrowDown")
        assert page.evaluate("viewerPrefs.graphTabGap === 10")
        bounds = divider.bounding_box()
        page.mouse.move(bounds["x"] + 20, bounds["y"] + 3)
        page.mouse.down()
        page.mouse.move(bounds["x"] + 20, bounds["y"] + 11)
        page.mouse.up()
        page.wait_for_function(
            "settingsText && JSON.parse(settingsText).preferences.graphTabGap === 18"
        )

        page.locator("#settingsOpen").click()
        assert page.evaluate("settingsDialog.open && !settingsDialog.matches(':modal')")
        # A real outside click still changes the main graph while settings is open.
        page.locator("#graphSubtab-kind").click()
        assert page.locator("#dimension").is_visible()
        before = page.locator("#viewerSettings").bounding_box()
        bar = page.locator("#settingsWindowTitle").bounding_box()
        page.mouse.move(bar["x"] + 25, bar["y"] + 15)
        page.mouse.down()
        page.mouse.move(bar["x"] + 65, bar["y"] + 45)
        page.mouse.up()
        after = page.locator("#viewerSettings").bounding_box()
        assert abs(after["x"] - before["x"] - 40) < 2
        assert abs(after["y"] - before["y"] - 30) < 2
        assert page.evaluate("""() => {
          const font = getComputedStyle($('plot')).fontSize;
          const event = new WheelEvent('wheel', {
            ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true,
          });
          settingsDialog.dispatchEvent(event);
          return event.defaultPrevented &&
            settingsDialog.style.getPropertyValue('--floating-scale') === '1.1' &&
            getComputedStyle($('plot')).fontSize === font;
        }""")
        page.locator("#settingsWindowTitle .floatingZoom button").nth(1).click()
        assert page.evaluate("settingsDialog.style.getPropertyValue('--floating-scale') === '1'")
        page.locator("#settingsWindowClose").click()
        assert not page.evaluate("settingsDialog.open")

        page.locator("#axisHelpOpen").click()
        assert page.locator("#axisHelpWindow").get_attribute("aria-modal") == "false"
        assert "Time_s" in page.locator("#axisHelpWindow").inner_text()
        assert "X·Y·Z" in page.locator("#axisHelpWindow").inner_text()
        page.locator("#graphSubtab-axes").click()
        assert page.locator("#x").is_visible()
        before = page.locator("#axisHelpWindow").bounding_box()
        page.locator("#axisHelpDrag").focus()
        page.keyboard.press("ArrowRight")
        after = page.locator("#axisHelpWindow").bounding_box()
        assert abs(after["x"] - before["x"] - 10) < 2
        page.evaluate("""axisHelp.dispatchEvent(new WheelEvent('wheel', {
          ctrlKey: true, deltaY: 100, bubbles: true, cancelable: true,
        }))""")
        assert page.evaluate("axisHelp.style.getPropertyValue('--floating-scale') === '0.9'")
        page.locator("#axisHelpClose").click()
        assert page.locator("#axisHelpWindow").is_hidden()
        assert not errors, errors
        print(entry, "PASS saved divider, no duplicate heading, modeless interaction, dragging, local Ctrl+wheel zoom, reset, help examples")
        page.close()
    browser.close()
server.shutdown()
