# Portfolio quality audit

Reviewed on 28 October 2026 against main commit
`5abafd8a708b262c65da68ec892f73bd6fbbbcfd`.

## Architecture

This is a static portfolio served by GitHub Pages. Its application consists of
`index.html`, `styles.css`, `script.js`, and media files. There are no API endpoints,
server processes, authentication flows, databases, or form submissions to audit.
A backend is not needed for the current portfolio features.

## Findings addressed

| Area | Before | Change |
| --- | --- | --- |
| Document structure | Contact ID appeared twice; gallery card headings shared their case-heading level | Unique IDs and a consistent section → case → card heading hierarchy |
| Keyboard access | Four custom comparisons had no keyboard control; slider arithmetic jumped from 0 to the middle | Eight labeled native range inputs with standard keyboard boundaries |
| Pointer behavior | Mouse and touch listeners duplicated the slider implementation | Pointer capture, bounded movement, cancellation cleanup, and vertical touch scrolling |
| Mobile navigation | Menu lacked Escape dismissal and control association; navigation was hidden without JavaScript | Disclosure semantics, closed-menu inert state, Escape, outside-click dismissal, resize cleanup, and a no-JavaScript fallback |
| Navigation | JavaScript intercepted links without updating URL/history | Native fragment navigation, focusable destinations, skip link, and sticky-header scroll offsets |
| Contrast | axe found five light-mode text contrast failures | Darker light-mode accent and readable captions on their dark image panels |
| Small screens | The gallery overflowed a 320px viewport to 345px | Grid columns shrink to the available width; long headings wrap |
| Motion | Runtime reduced-motion changes were not reflected in script state; the hero animation retained a transform that overrode button hover | Reveal observers disconnect when reduced motion is enabled; hero hover works after entrance completes |
| Media loading | Four large videos requested metadata before playback; images lacked complete intrinsic dimensions | Videos wait for playback, images reserve their dimensions, and existing lazy loading is preserved |
| Dependencies and security | One comparison relied on external executable JavaScript; inline styling was scattered throughout HTML | All comparisons use local code; a restrictive CSP, explicit referrer policy, and class-based styling replace that dependency and inline styles |
| Discoverability | Minimal page metadata | Descriptive title, canonical URL, and Open Graph metadata |
| Maintenance | No repeatable checks on pull requests | EditorConfig, pinned development dependency, regression tests, and a CI workflow |

The four videos have no audio tracks, as checked with ffprobe. Existing media,
clinical descriptions, contact destinations, and the overall visual design are
preserved. Media paths containing spaces are URL-encoded; the files are unchanged.

## Verification

- Static checks: unique IDs, internal links and ARIA references, local asset paths,
  image sizing and naming, media loading policy, and external-resource boundaries.
- Chromium: desktop/mobile layouts from 320px to 1920px, native anchor history and
  focus, menu dismissal and resize states, all eight keyboard controls, clamped
  mouse dragging, touch dragging and vertical scrolling, theme behavior, and
  repeat initialization.
- Browser fallbacks: JavaScript disabled, IntersectionObserver unavailable,
  reduced motion at startup and during a session, and print before scrolling.
- axe-core 4.10.3: WCAG A/AA and best-practice rules in both light and dark themes,
  including additional scans with the actual pinned icon stylesheet and fonts.
  Five baseline light-mode contrast failures were resolved. This automated scan
  does not establish complete WCAG conformance.
- Font Awesome's existing SHA-512 integrity hash was checked against the actual
  pinned CDN stylesheet. Core interaction tests block the optional icon CDN.

## Limits and hosting responsibilities

This audit tests a local copy of the repository, not live GitHub Pages response
headers or real-user performance metrics. GitHub Pages controls HTTP security
headers and caching. A CSP meta tag cannot configure response-only directives
such as `frame-ancestors`; those require a host or proxy that supports headers.

Original high-resolution portfolio images and videos are retained to preserve
clinical detail. They can still be large when opened or played; deferring them
does not make the files smaller. Any future media compression should be checked
visually for loss of relevant detail.

The remaining external dependency is the pinned, integrity-checked Font Awesome
stylesheet and its font files. No third-party JavaScript executes on the page.
Real assistive-technology testing and physical Safari/Firefox device checks remain
manual follow-ups; Chromium touch emulation is not a substitute for those devices.
