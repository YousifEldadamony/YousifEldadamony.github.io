# Yousif Eldadamony — dental CAD/CAM portfolio

Static HTML, CSS, and JavaScript hosted on GitHub Pages. There is no application
backend, database, API, or build step. Contact links open email and external profiles.

## Local preview

Run `python3 -m http.server 8000` from the repository root and open
`http://localhost:8000`. A local HTTP server is needed because the Content Security
Policy deliberately prevents loading resources from arbitrary origins.

## Quality checks

Python 3.12+ and Chromium are used only for development tests:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python -m unittest discover -s tests -v
node --check script.js
```

The browser tests cover navigation, all eight native comparison sliders, touch and
mouse dragging, keyboard boundaries, responsive layout, themes, printing, reduced
motion, and behavior without JavaScript. Asset references and HTML IDs are checked
too. The optional icon CDN is blocked during these tests to verify essential
behavior without it.

To include automated accessibility checks, download the pinned axe-core release,
verify its checksum, and set `AXE_CORE_PATH`:

```sh
mkdir -p test-results
curl --fail --silent --show-error --location https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js -o test-results/axe.min.js
echo '880970c081707360e64f34cea25ff91892f5bc95675b0776925b9709dd8a68bb  test-results/axe.min.js' | sha256sum --check
AXE_CORE_PATH=test-results/axe.min.js python -m unittest discover -s tests -v
```

The **Site quality** GitHub Actions workflow runs the complete suite, including axe,
on pull requests and pushes to `main`. Automated checks supplement visual and
assistive-technology testing; they do not certify WCAG compliance.

## Maintenance

- Keep production JavaScript local. The only CDN resource is the pinned Font Awesome
  stylesheet and its fonts; its stylesheet uses Subresource Integrity.
- Keep CSP changes in sync with any new external resource or form integration.
- Give images meaningful alternate text and intrinsic dimensions. Keep below-fold
  images lazy and videos at `preload="none"` so they load when played.
- Preserve native anchor navigation and range-input semantics. Use the regression
  suite before merging interaction changes.
- Keep credentials out of browser code. This static site currently needs no secrets.

See [the quality audit](docs/quality-audit.md) for findings and hosting boundaries.
