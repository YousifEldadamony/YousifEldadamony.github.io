from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess
import unittest

from scripts.generate_video_posters import Videos, generate


class VideoPosters(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.page = self.root / "index.html"
        self.video = self.root / "clip one.mp4"
        self.make_video("red")

    def make_video(self, color):
        subprocess.run([
            "ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-f", "lavfi",
            "-i", f"color=c={color}:s=128x72:d=0.2", "-threads", "1", str(self.video),
        ], check=True, timeout=30)

    def poster(self):
        return Videos(self.page.read_text()).videos[0][2]["poster"]

    def test_short_clip_with_nested_source_and_idempotence(self):
        self.page.write_text('<h2>Keep this text</h2>\n<video controls><source src="clip%20one.mp4"></video>\n')
        self.assertEqual(generate(self.page), 1)
        image = self.root / self.poster()
        self.assertGreater(image.stat().st_size, 0)
        before = (self.page.read_bytes(), image.stat().st_mtime_ns)
        self.assertEqual(generate(self.page), 0)
        self.assertEqual(before, (self.page.read_bytes(), image.stat().st_mtime_ns))
        self.assertIn('<h2>Keep this text</h2>\n', self.page.read_text())

    def test_replacing_video_refreshes_generated_cover(self):
        self.page.write_text('<video src="clip one.mp4"></video>')
        generate(self.page)
        old = self.poster()
        self.make_video("blue")
        self.assertEqual(generate(self.page), 1)
        self.assertNotEqual(self.poster(), old)
        self.assertTrue((self.root / self.poster()).is_file())

    def test_custom_cover_is_preserved(self):
        (self.root / "cover.jpg").write_bytes(b"a chosen custom cover")
        source = '<video src="clip one.mp4" poster="cover.jpg"></video>'
        self.page.write_text(source)
        self.assertEqual(generate(self.page), 0)
        self.assertEqual(self.page.read_text(), source)

    def test_missing_cover_is_repaired_without_rewriting_labels(self):
        self.page.write_text("<video aria-label='a poster=example label' src='clip one.mp4' poster='missing.jpg'></video>")
        generate(self.page)
        self.assertIn("aria-label='a poster=example label'", self.page.read_text())
        self.assertTrue((self.root / self.poster()).is_file())

    def test_invalid_video_and_outside_paths_leave_html_unchanged(self):
        for url in ("missing.mp4", "../outside.mp4"):
            source = f'<video src="{url}"></video>'
            self.page.write_text(source)
            with self.assertRaises(ValueError):
                generate(self.page)
            self.assertEqual(self.page.read_text(), source)


if __name__ == "__main__":
    unittest.main()
