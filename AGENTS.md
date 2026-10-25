# Development workflow

Use the existing checkout; cloud tasks are already isolated. Do not create Git worktrees unless requested.

Edit application files under source/. After every software change run `python scripts/build_standalone.py`. This automatically bumps the patch version and records the build timestamp in Asia/Seoul when source contents change. Unchanged builds retain the same version and timestamp.

Commit build.json, source/build-info.js, and CSVtoGraphViewer.html with the corresponding source changes. Do not hand-edit generated HTML or version stamps. The offline HTML and editable source must offer identical behavior. When updating the authorized gh-pages deployment, copy the rebuilt CSVtoGraphViewer.html to index.html on that branch.

Use relevant browser smoke scripts under tests/ to verify behavior. They require Python playwright and /usr/bin/chromium and create their own HTTP servers and temporary in-memory CSV data. `python tests/build_stamp_smoke.py` checks version behavior in an isolated temporary copy.

Panel layout preferences are workspace settings, not graph-template fields. Keep original CSV and user workspace files intact except for explicitly requested user actions.
