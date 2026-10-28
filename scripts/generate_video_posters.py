"""Generate and link lightweight posters for local videos in index.html."""

from hashlib import file_digest
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import unquote, urlsplit
import re
import subprocess


class Videos(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.lines = [0] + [match.end() for match in re.finditer("\n", source)]
        self.videos = []
        self.current = None
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "video":
            line, column = self.getpos()
            self.current = [self.lines[line - 1] + column, self.get_starttag_text(), attrs]
            self.videos.append(self.current)
        elif tag == "source" and self.current and not self.current[2].get("src"):
            self.current[2]["src"] = attrs.get("src")

    def handle_endtag(self, tag):
        if tag == "video":
            self.current = None


def local_path(root, url):
    parts = urlsplit(url)
    if parts.scheme or parts.netloc:
        return None
    path = (root / unquote(parts.path).lstrip("/")).resolve()
    if not path.is_relative_to(root):
        raise ValueError(f"Media path leaves the site directory: {url}")
    return path


def thumbnail(video, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=destination.parent) as temp:
        image = Path(temp) / "frame.jpg"
        for seek in ("1", "0"):
            try:
                subprocess.run([
                    "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                    "-ss", seek, "-i", str(video), "-frames:v", "1",
                    "-vf", "scale='min(960,iw)':-2", "-pix_fmt", "yuvj420p",
                    "-q:v", "4", "-threads", "1", str(image),
                ], check=True, timeout=60)
            except subprocess.CalledProcessError:
                if seek == "0":
                    raise
                continue
            if image.is_file() and image.stat().st_size:
                image.replace(destination)
                return
        raise ValueError(f"Could not extract a preview from {video}")


def generate(page):
    page = Path(page).resolve()
    root = page.parent
    source = page.read_text(encoding="utf-8")
    edits = []
    for offset, tag, attrs in Videos(source).videos:
        poster = local_path(root, attrs["poster"]) if attrs.get("poster") else None
        managed = (poster and poster.parent == root / "Assets/Video-Posters"
                   and re.fullmatch(r"auto-[0-9a-f]{16}\.jpg", poster.name))
        if attrs.get("poster") and (poster is None or poster.is_file()) and not managed:
            continue  # Preserve explicitly chosen custom covers.
        video = local_path(root, attrs.get("src") or "")
        if video is None:
            continue
        if not video.is_file():
            raise ValueError(f"Video does not exist: {attrs.get('src')}")
        with video.open("rb") as stream:
            digest = file_digest(stream, "sha256").hexdigest()[:16]
        url = f"Assets/Video-Posters/auto-{digest}.jpg"
        destination = local_path(root, url)
        if not destination.is_file() or not destination.stat().st_size:
            thumbnail(video, destination)
        replacement = f' poster="{escape(url, quote=True)}"'
        # Tokenize whole attributes so text inside labels is never replaced.
        attributes = re.finditer(r'''\s+([^\s=/>]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?''', tag)
        existing = next((match for match in attributes if match[1].lower() == "poster"), None)
        position = existing.start() if existing else re.search(r"\s*/?>$", tag).start()
        end = existing.end() if existing else position
        updated = tag[:position] + replacement + tag[end:]
        if updated != tag:
            edits.append((offset, len(tag), updated))
    for offset, length, updated in reversed(edits):
        source = source[:offset] + updated + source[offset + length:]
    if edits:
        page.write_text(source, encoding="utf-8")
    return len(edits)


if __name__ == "__main__":
    page = Path(__file__).resolve().parents[1] / "index.html"
    print(f"Updated {generate(page)} video preview link(s).")
