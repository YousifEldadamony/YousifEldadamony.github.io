"""Static checks and browser regressions for the portfolio. No production server required."""

from collections import Counter
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import unquote, urlsplit
import os
import unittest

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.elements = []

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))


class StaticChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = Document()
        cls.doc.feed((ROOT / "index.html").read_text())

    def test_unique_ids_and_valid_local_references(self):
        ids = [attrs["id"] for _, attrs in self.doc.elements if "id" in attrs]
        self.assertEqual(len(ids), len(set(ids)), "Duplicate HTML IDs")
        for tag, attrs in self.doc.elements:
            for key in ("aria-controls", "aria-labelledby", "aria-describedby"):
                for target in attrs.get(key, "").split():
                    self.assertIn(target, ids, (tag, key, target))
            for key in ("src", "href", "poster"):
                url = urlsplit(attrs.get(key, ""))
                if url.scheme or url.netloc:
                    continue
                if url.path:
                    self.assertTrue((ROOT / unquote(url.path)).is_file(), url.path)
                elif url.fragment:
                    self.assertIn(unquote(url.fragment), ids)
        self.assertEqual(Counter(tag for tag, _ in self.doc.elements)["h1"], 1)

    def test_media_is_named_and_sized(self):
        for tag, attrs in self.doc.elements:
            if tag == "img":
                self.assertIn("alt", attrs)
                self.assertGreater(int(attrs["width"]), 0)
                self.assertGreater(int(attrs["height"]), 0)
                if "brand-logo" not in attrs.get("class", ""):
                    self.assertEqual(attrs.get("loading"), "lazy")
            if tag == "video":
                self.assertEqual(attrs.get("preload"), "none")
                self.assertTrue(attrs.get("aria-label"))
                self.assertTrue(attrs.get("poster"))

    def test_security_and_dependency_boundaries(self):
        policies = [a["content"] for tag, a in self.doc.elements
                    if tag == "meta" and a.get("http-equiv") == "Content-Security-Policy"]
        self.assertEqual(len(policies), 1)
        self.assertIn("script-src 'self'", policies[0])
        self.assertIn("object-src 'none'", policies[0])
        self.assertNotIn("unsafe-inline", policies[0])
        for tag, attrs in self.doc.elements:
            self.assertNotIn("style", attrs)
            self.assertFalse(any(key.startswith("on") for key in attrs))
            if tag == "script":
                self.assertEqual(attrs.get("src"), "script.js")
                self.assertIn("defer", attrs)
            if tag == "link" and attrs.get("href", "").startswith("https://cdnjs."):
                self.assertTrue(attrs.get("integrity", "").startswith("sha512-"))
                self.assertEqual(attrs.get("crossorigin"), "anonymous")
            if attrs.get("target") == "_blank":
                self.assertIn("noopener", attrs.get("rel", "").split())


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def copyfile(self, source, target):
        try:
            super().copyfile(source, target)
        except (BrokenPipeError, ConnectionResetError):
            pass


class BrowserChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/"
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_EXECUTABLE"),
            args=["--no-sandbox"] if os.environ.get("CHROMIUM_EXECUTABLE") else [],
        )

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1280, "height": 800})
        # Test essential behavior even when the optional icon CDN is unavailable.
        self.context.route("https://**/*", lambda route: route.abort())
        self.context.add_init_script("""
          window.policyViolations = [];
          document.addEventListener('securitypolicyviolation', event => {
            window.policyViolations.push(event.violatedDirective);
          });
        """)
        self.errors = []
        self.media_requests = []
        self.page = self.context.new_page()
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("request", lambda request: self.media_requests.append(request.url)
                     if request.resource_type == "media" else None)
        self.page.goto(self.url)
        self.page.wait_for_function("() => window.__portfolioInteractionsInitialized === true")

    def tearDown(self):
        errors = self.errors
        violations = self.page.evaluate("window.policyViolations")
        self.context.close()
        self.assertEqual(errors, [], "JavaScript runtime errors")
        self.assertEqual(violations, [], "Content Security Policy violations")

    def test_responsive_layout(self):
        for width in (320, 375, 720, 768, 1280, 1920):
            with self.subTest(width=width):
                self.page.set_viewport_size({"width": width, "height": 800})
                self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), width)

    def test_videos_do_not_download_before_playback(self):
        self.page.wait_for_timeout(500)
        for video in self.page.locator("video").all():
            self.assertTrue(self.page.evaluate("""async src => {
              const image = new Image();
              image.src = src;
              await image.decode();
              return image.naturalWidth > 0;
            }""", video.get_attribute("poster")))
        self.assertEqual(self.media_requests, [])

    def test_touch_drag_and_vertical_page_scrolling(self):
        context = self.browser.new_context(has_touch=True, is_mobile=True,
                                           viewport={"width": 375, "height": 667}, reduced_motion="reduce")
        context.route("https://**/*", lambda route: route.abort())
        page = context.new_page()
        try:
            page.goto(self.url)
            container = page.locator(".image-comparison-container").first
            container.scroll_into_view_if_needed()
            rect = container.bounding_box()
            session = context.new_cdp_session(page)
            x = rect["x"] + rect["width"] / 2
            y = rect["y"] + rect["height"] / 2
            session.send("Input.dispatchTouchEvent", {"type":"touchStart", "touchPoints":[{"x":x,"y":y}]})
            session.send("Input.dispatchTouchEvent", {"type":"touchMove", "touchPoints":[{"x":rect["x"]+rect["width"]*.75,"y":y}]})
            session.send("Input.dispatchTouchEvent", {"type":"touchEnd", "touchPoints":[]})
            # Device-coordinate rounding can move the native thumb by one step.
            self.assertAlmostEqual(int(container.locator("input").input_value()), 75, delta=1)
            self.assertFalse(container.evaluate("e=>e.classList.contains('is-dragging')"))
            before = page.evaluate("scrollY")
            session.send("Input.dispatchTouchEvent", {"type":"touchStart", "touchPoints":[{"x":x,"y":y}]})
            for offset in (20, 40, 60, 80):
                session.send("Input.dispatchTouchEvent", {"type":"touchMove", "touchPoints":[{"x":x,"y":y-offset}]})
            session.send("Input.dispatchTouchEvent", {"type":"touchEnd", "touchPoints":[]})
            page.wait_for_timeout(300)
            self.assertGreater(page.evaluate("scrollY"), before)
            self.assertFalse(container.evaluate("e=>e.classList.contains('is-dragging')"))
        finally:
            context.close()

    def test_skip_link_and_native_anchor_history(self):
        self.page.emulate_media(reduced_motion="reduce")
        self.page.keyboard.press("Tab")
        self.assertEqual(self.page.evaluate("document.activeElement.textContent"), "Skip to main content")
        self.page.keyboard.press("Enter")
        self.page.wait_for_url("**/#main-content")
        self.assertEqual(self.page.evaluate("document.activeElement.id"), "main-content")
        self.page.locator('.main-nav a[href="#about"]').click()
        self.page.wait_for_url("**/#about")
        self.assertEqual(self.page.evaluate("document.activeElement.id"), "about")
        self.assertGreaterEqual(self.page.locator("#about").bounding_box()["y"],
                                self.page.locator(".site-header").bounding_box()["height"])
        self.page.go_back()
        self.page.wait_for_url("**/#main-content")

    def test_mobile_disclosure_keyboard_outside_click_and_resize(self):
        self.page.set_viewport_size({"width": 375, "height": 667})
        toggle = self.page.locator(".nav-toggle")
        nav = self.page.locator(".main-nav")
        self.page.wait_for_function("() => document.querySelector('.main-nav').inert")
        toggle.focus()
        toggle.press("Enter")
        self.assertEqual(toggle.get_attribute("aria-expanded"), "true")
        self.assertFalse(nav.evaluate("e => e.inert"))
        self.page.keyboard.press("Tab")
        self.assertEqual(self.page.evaluate("document.activeElement.textContent"), "About")
        self.page.keyboard.press("Escape")
        self.assertEqual(toggle.get_attribute("aria-expanded"), "false")
        self.assertEqual(self.page.evaluate("document.activeElement.className"), "nav-toggle")
        toggle.click()
        self.page.locator(".theme-toggle").click()
        self.assertEqual(toggle.get_attribute("aria-expanded"), "false")
        toggle.click()
        self.page.locator('.main-nav a[href="#contact"]').click()
        self.page.wait_for_url("**/#contact")
        self.assertEqual(toggle.get_attribute("aria-expanded"), "false")
        self.page.set_viewport_size({"width": 1280, "height": 800})
        self.page.wait_for_function("() => !document.querySelector('.main-nav').inert")
        self.page.set_viewport_size({"width": 375, "height": 667})
        self.page.wait_for_function("() => document.querySelector('.main-nav').inert")

    def test_all_sliders_keyboard_bounds_and_visual_state(self):
        self.page.emulate_media(reduced_motion="reduce")
        controls = self.page.get_by_role("slider")
        self.assertEqual(controls.count(), 8)
        for control in controls.all():
            with self.subTest(label=control.get_attribute("aria-labelledby")):
                self.assertTrue(control.is_enabled())
                control.focus()
                for key, value in (("Home", "0"), ("ArrowLeft", "0"), ("ArrowRight", "1"),
                                   ("End", "100"), ("ArrowRight", "100"), ("ArrowLeft", "99")):
                    control.press(key)
                    self.assertEqual(control.input_value(), value)
                    self.assertEqual(control.locator("..").evaluate(
                        "e => e.style.getPropertyValue('--comparison-position')"), value + "%")

    def test_pointer_capture_clamps_drags_and_releases(self):
        self.page.emulate_media(reduced_motion="reduce")
        container = self.page.locator(".image-comparison-container").first
        container.scroll_into_view_if_needed()
        rect = container.bounding_box()
        y = rect["y"] + rect["height"] / 2
        self.page.mouse.move(rect["x"] + rect["width"] / 2, y)
        self.page.mouse.down()
        self.page.mouse.move(rect["x"] - 10, y)
        self.assertEqual(container.locator("input").input_value(), "0")
        self.page.mouse.move(rect["x"] + rect["width"] + 10, y)
        self.assertEqual(container.locator("input").input_value(), "100")
        self.page.mouse.up()
        self.assertFalse(container.evaluate("e => e.classList.contains('is-dragging')"))
        for width in (375, 1280):
            self.page.set_viewport_size({"width": width, "height": 800})
            sizes = container.evaluate("e => [e.querySelector('.img-base').getBoundingClientRect().width, e.querySelector('.img-overlay').getBoundingClientRect().width]")
            self.assertAlmostEqual(*sizes, places=1)

    def test_theme_and_idempotent_initialization(self):
        self.page.evaluate((ROOT / "script.js").read_text())
        toggle = self.page.locator(".theme-toggle")
        toggle.click()
        self.assertEqual(toggle.get_attribute("aria-pressed"), "true")
        self.assertIn("light-theme", self.page.locator("body").get_attribute("class"))
        toggle.click()
        self.assertEqual(toggle.get_attribute("aria-pressed"), "false")

    def test_hero_button_hover_after_entrance(self):
        self.page.wait_for_timeout(900)
        button = self.page.locator(".hero .button")
        button.hover()
        self.page.wait_for_timeout(250)
        self.assertEqual(button.evaluate("e => new DOMMatrix(getComputedStyle(e).transform).m42"), -2)

    def test_reduced_motion_changes_and_observer_fallback(self):
        self.page.emulate_media(reduced_motion="reduce")
        self.page.wait_for_function("() => !document.querySelector('.reveal')")
        self.assertEqual(self.page.locator("html").evaluate("e => getComputedStyle(e).scrollBehavior"), "auto")
        self.page.add_init_script("delete window.IntersectionObserver")
        self.page.emulate_media(reduced_motion="no-preference")
        self.page.reload()
        self.assertEqual(self.page.locator(".reveal").count(), 0)

    def test_print_before_scrolling_and_card_fades(self):
        self.assertEqual(self.page.evaluate("scrollY"), 0)
        self.assertGreater(self.page.locator(".reveal:not(.is-visible)").count(), 0)
        self.page.emulate_media(media="print")
        self.page.wait_for_timeout(550)
        states = self.page.locator(".reveal, .hero h1").evaluate_all(
            "els => els.map(e => ({opacity:getComputedStyle(e).opacity,transform:getComputedStyle(e).transform}))")
        self.assertTrue(all(state["opacity"] == "1" and state["transform"] == "none" for state in states))
        self.page.emulate_media(media="screen")
        for selector in ("#capabilities .card", "#guided-surgery-cards .model-card", ".stack-list"):
            target = self.page.locator(selector).first
            target.scroll_into_view_if_needed()
            self.page.wait_for_function("e => e.classList.contains('is-visible')", arg=target.element_handle())
            target.evaluate("e => e.classList.remove('is-visible')")
            self.page.wait_for_timeout(550)
            target.evaluate("e => e.classList.add('is-visible')")
            self.page.wait_for_timeout(100)
            opacity = float(target.evaluate("e => getComputedStyle(e).opacity"))
            self.assertGreater(opacity, 0)
            self.assertLess(opacity, 1)
            self.page.wait_for_timeout(550)

    def test_no_javascript_mobile_fallback(self):
        context = self.browser.new_context(java_script_enabled=False, viewport={"width": 320, "height": 667})
        context.route("https://**/*", lambda route: route.abort())
        page = context.new_page()
        try:
            page.goto(self.url)
            self.assertTrue(page.locator(".main-nav").is_visible())
            self.assertFalse(page.locator(".nav-toggle").is_visible())
            self.assertFalse(page.locator(".theme-toggle").is_visible())
            self.assertTrue(all(control.is_disabled() for control in page.locator(".comparison-range").all()))
            page.locator('.main-nav a[href="#about"]').click()
            page.wait_for_url("**/#about")
            self.assertLessEqual(page.evaluate("document.documentElement.scrollWidth"), 320)
        finally:
            context.close()

    @unittest.skipUnless(os.environ.get("AXE_CORE_PATH"), "Set AXE_CORE_PATH to run axe WCAG checks")
    def test_automated_accessibility_both_themes(self):
        self.page.emulate_media(reduced_motion="reduce")
        axe = Path(os.environ["AXE_CORE_PATH"]).read_text()
        self.page.evaluate(axe + "\n;void 0;")
        for light in (False, True):
            if light:
                self.page.locator(".theme-toggle").click()
            self.page.wait_for_timeout(550)
            result = self.page.evaluate("""async () => await axe.run(document, {
              preload: false,
              runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21aa','best-practice']}
            })""")
            self.assertEqual([(v["id"], len(v["nodes"])) for v in result["violations"]], [],
                             "Automated accessibility violations in " + ("light" if light else "dark") + " mode")


if __name__ == "__main__":
    unittest.main(verbosity=2)
