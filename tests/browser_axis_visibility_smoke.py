"""Verify separate coordinate pages, two menu rows, and dimension/template changes."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root)))
Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for entry in ['source/index.html', 'CSVtoGraphViewer.html']:
        page = browser.new_page(viewport={'width':1440, 'height':1000})
        errors=[]
        page.on('pageerror', lambda e:errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/{entry}')
        page.evaluate("workspaceDialog.close();load('T,X,Y,Z\\n0,1,2,3\\n1,2,3,4','records.csv');openGraphSection('x')")
        assert page.locator('#x').is_visible() and page.locator('#taxis').is_visible()
        assert page.locator('.fileXSection').is_visible()
        assert page.locator('#columns').is_hidden()
        assert page.locator('#graphSubtab-z').is_hidden()
        positions = page.locator('.graphSubtabs button:visible').evaluate_all('els=>Object.fromEntries(els.map(e=>[e.id,e.getBoundingClientRect().top]))')
        assert positions['graphSubtab-kind'] == positions['graphSubtab-range']
        assert positions['graphSubtab-x'] == positions['graphSubtab-y'] > positions['graphSubtab-kind']
        page.locator('#graphSubtab-y').click()
        assert page.locator('#columns').is_visible() and page.locator('#selection').is_visible()
        assert page.locator('#layout').is_visible()
        assert page.locator('#x').is_hidden() and page.locator('#taxis').is_hidden()
        assert page.locator('#yaxis3').is_hidden()
        page.locator('#selection').select_option('multi')
        page.locator('#all').click()
        selected = page.evaluate('[...selected]')
        page.locator('#layout').select_option('split')
        assert page.evaluate("panels.length===selected.size && $('quickGraphSplit').checked")
        page.locator('#layout').select_option('overlay')
        assert page.evaluate('panels.length===1')
        page.locator('#graphSubtab-kind').click()
        page.locator('#dimension').select_option('3d')
        assert page.locator('#graphSubtab-z').is_visible()
        page.locator('#graphSubtab-x').click()
        assert page.locator('#x').is_visible() and page.locator('#taxis').is_visible()
        assert page.locator('#yaxis3').is_hidden() and page.locator('.fileXSection').is_hidden()
        page.locator('#graphSubtab-y').click()
        assert page.locator('#yaxis3').is_visible()
        assert page.locator('#columns').is_hidden() and page.locator('#layout').is_hidden()
        page.locator('#yaxis3').select_option('2')
        page.locator('#graphSubtab-z').click()
        assert page.locator('#zaxis').is_visible() and page.locator('#yaxis3').is_hidden()
        page.locator('#zaxis').select_option('3')
        page.evaluate('window.threeTemplate=captureTemplate()')
        # Switching a template's dimension while Z was open selects Y without leaving Templates.
        page.evaluate("showTab('template');$('dimension').value='2d';draw()")
        assert page.locator('#templatePanel').is_visible()
        assert page.evaluate("graphSections.y.button.getAttribute('aria-selected')==='true'")
        page.evaluate("openGraphSection('y')")
        assert page.locator('#columns').is_visible()
        assert page.evaluate('[...selected]') == selected
        page.evaluate('applyTemplate(threeTemplate)')
        assert page.locator('#yaxis3').is_visible()
        page.locator('#graphSubtab-z').click()
        page.locator('#graphSubtab-z').focus()
        page.keyboard.press('ArrowRight')
        assert page.locator('#graphSubtab-kind').evaluate('e=>e===document.activeElement')
        page.keyboard.press('End')
        assert page.locator('#zaxis').is_visible()
        page.locator('#graphSubtab-range').click()
        assert page.locator('#applybounds').is_visible()
        page.locator('#templateTab').click()
        page.locator('#clearCurrentTemplate').click()
        page.evaluate("openGraphSection('y')")
        assert page.locator('#columns').is_visible() and page.locator('#graphSubtab-z').is_hidden()
        page.locator('#plot').click(button='right')
        assert page.locator('#graphContextMenu [data-graph-section="z"]').is_hidden()
        page.locator('#graphContextMenu [data-graph-section="x"]').click()
        assert page.locator('#x').is_visible()
        assert not errors,errors
        print(entry,'PASS two-row graph menu, X/Y/Z pages, multiple Y split/overlay, 3D-only Z, values preserved, template fallback, keyboard and context shortcuts')
        page.close()
    browser.close()
server.shutdown()
