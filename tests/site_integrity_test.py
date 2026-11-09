"""Check local page references and the published site's embedded client data.

Run against the source tree, or against a Pages build:
    python3 tests/site_integrity_test.py
    python3 tests/site_integrity_test.py --site-dir _site --base-path /eleven-portfolio/
"""

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlsplit


ROOT = Path(__file__).resolve().parents[1]
PROJECTS = ("delysium", "digital-china", "deep-blue", "bard-ai")
FLIGHT_PUSH = re.compile(r"^\s*self\.__next_f\.push\((.*)\)\s*;?\s*$", re.S)
CSS_URL = re.compile(r"url\(\s*(?:'([^']*)'|\"([^\"]*)\"|([^)]*))\s*\)", re.I)


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.references = []
        self.canonicals = []
        self.scripts = []
        self.script = None

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        for key in ("src", "href"):
            if attributes.get(key):
                self.references.append((f"{tag}[{key}]", attributes[key]))
        if tag == "link" and "canonical" in attributes.get("rel", "").split():
            self.canonicals.append(attributes.get("href"))
        if tag == "script":
            self.script = []

    def handle_data(self, data):
        if self.script is not None:
            self.script.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.script is not None:
            self.scripts.append("".join(self.script))
            self.script = None


class IntegrityCheck:
    def __init__(self, site_dir, base_path):
        self.site = site_dir.resolve()
        self.base = base_path
        self.errors = []
        self.counts = {"references": 0, "manifests": 0, "imports": 0, "text_records": 0}

    def require(self, condition, message):
        if not condition:
            self.errors.append(message)
        return condition

    def reference(self, value, document_path, context):
        if not isinstance(value, str) or not value or value.startswith(("#", "$")):
            return
        parts = urlsplit(value)
        if parts.scheme or parts.netloc:
            return
        absolute_path = unquote(urlsplit(urljoin(document_path, value)).path)
        if not self.require(absolute_path.startswith(self.base), f"{context}: URL escapes base path: {value}"):
            return
        relative = absolute_path[len(self.base):]
        target = (self.site / relative).resolve()
        if not self.require(target.is_relative_to(self.site), f"{context}: URL escapes site directory: {value}"):
            return
        if target.is_dir():
            target = target / "index.html"
        self.counts["references"] += 1
        self.require(target.is_file(), f"{context}: missing file for {value}")

    def flight_value(self, value, document_path, context):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in {"src", "href"}:
                    self.reference(child, document_path, context + ": " + key)
                self.flight_value(child, document_path, context)
        elif isinstance(value, list):
            for child in value:
                self.flight_value(child, document_path, context)

    def flight(self, scripts, document_path, context):
        # Parse the protocol as UTF-8 bytes, independently of the build helper.
        # T records specify byte lengths and need not end at a script boundary.
        chunks = []
        for script in scripts:
            match = FLIGHT_PUSH.fullmatch(script)
            if not match:
                continue
            try:
                payload = json.loads(match[1])
            except json.JSONDecodeError as error:
                self.errors.append(f"{context}: invalid Flight script: {error}")
                continue
            if isinstance(payload, list) and len(payload) > 1 and payload[0] == 1 and isinstance(payload[1], str):
                chunks.append(payload[1])
        if not self.require(bool(chunks), f"{context}: missing Flight data"):
            return
        stream = "".join(chunks).encode("utf-8")
        position = 0
        canonical = None
        while position < len(stream):
            if stream[position:position + 1] == b"\n":
                position += 1
                continue
            header = re.match(rb"([0-9a-f]*):", stream[position:])
            if not self.require(header is not None, f"{context}: malformed Flight record at byte {position}"):
                break
            key = header[1].decode("ascii")
            position += header.end()
            text = re.match(rb"T([0-9a-f]+),", stream[position:])
            if text:
                length = int(text[1], 16)
                position += text.end()
                body = stream[position:position + length]
                if not self.require(len(body) == length, f"{context}: Flight {key} text record is shorter than its byte length"):
                    break
                try:
                    decoded = body.decode("utf-8")
                    # The site's text records contain JSON-LD. Validating it
                    # also catches byte lengths that cut or consume a record.
                    value = json.loads(decoded)
                except (UnicodeDecodeError, json.JSONDecodeError) as error:
                    self.errors.append(f"{context}: Flight {key} text byte length/content mismatch: {error}")
                    break
                self.flight_value(value, document_path, f"{context}: Flight {key}")
                self.counts["text_records"] += 1
                position += length
                continue
            end = stream.find(b"\n", position)
            if end < 0:
                end = len(stream)
            record = stream[position:end].decode("utf-8")
            position = end + 1
            if key == "0":
                try:
                    canonical = json.loads(record)
                except json.JSONDecodeError as error:
                    self.errors.append(f"{context}: invalid canonical Flight data: {error}")
            if record.startswith("I["):
                try:
                    imported = json.loads(record[1:])
                    paths = imported[1]
                    if not isinstance(paths, list) or len(paths) % 2:
                        raise ValueError("chunk list must contain ID/path pairs")
                    for asset in paths[1::2]:
                        if not isinstance(asset, str) or not asset.startswith("static/chunks/"):
                            raise ValueError(f"unexpected chunk path: {asset!r}")
                        self.reference(self.base + "_next/" + asset, document_path, f"{context}: Flight import")
                        self.counts["imports"] += 1
                except (json.JSONDecodeError, IndexError, TypeError, ValueError) as error:
                    self.errors.append(f"{context}: invalid Flight import: {error}")
            tagged = re.match(r"[A-Z]*([\[{].*)", record, re.S)
            if tagged:
                try:
                    self.flight_value(json.loads(tagged[1]), document_path, f"{context}: Flight {key}")
                except json.JSONDecodeError:
                    pass  # Other protocol tags are not JSON records.
        if self.require(isinstance(canonical, dict), f"{context}: missing canonical Flight record") and self.base != "/":
            self.require(canonical.get("p") == self.base.rstrip("/"), f"{context}: incorrect Flight asset prefix")
            self.require(canonical.get("c") == document_path.split("/"), f"{context}: incorrect Flight canonical route")

    def pages(self):
        for relative, route in (("index.html", ""), ("en/index.html", "en/")):
            target = self.site / relative
            if not self.require(target.is_file(), f"Missing page: {relative}"):
                continue
            page = Page()
            page.feed(target.read_text(encoding="utf-8"))
            document_path = self.base + route
            for tag, value in page.references:
                self.reference(value, document_path, f"{relative}: {tag}")
            self.require(page.canonicals == [document_path], f"{relative}: incorrect canonical link: {page.canonicals!r}")
            self.flight(page.scripts, document_path, relative)

    def manifests(self):
        for project in PROJECTS:
            relative = f"assets/{project}/portfolio-manifest.json"
            target = self.site / relative
            if not self.require(target.is_file(), f"Missing manifest: {relative}"):
                continue
            try:
                manifest = json.loads(target.read_text(encoding="utf-8"))
                sections = manifest["sections"]
                if not isinstance(sections, list) or not sections:
                    raise ValueError("missing portfolio sections")
                section_ids = set()
                for section in sections:
                    if not isinstance(section.get("id"), str) or section["id"] in section_ids:
                        raise ValueError("missing or duplicate section ID")
                    section_ids.add(section["id"])
                    images = section.get("pages", [section])
                    if not isinstance(images, list) or not images:
                        raise ValueError("missing portfolio images")
                    for image in images:
                        src = image["src"]
                        if not isinstance(src, str) or not src.startswith(self.base + f"assets/{project}/"):
                            raise ValueError(f"image path is outside its project: {src!r}")
                        if any(type(image.get(key)) is not int or image[key] < 1 for key in ("width", "height")):
                            raise ValueError(f"invalid image dimensions: {src}")
                        self.reference(src, self.base, relative)
                self.counts["manifests"] += 1
            except (json.JSONDecodeError, KeyError, TypeError, ValueError, AttributeError) as error:
                self.errors.append(f"{relative}: invalid manifest: {error}")

    def stylesheets(self):
        for target in self.site.rglob("*.css"):
            # Source previews have ignored archives/build outputs alongside
            # their actual public directories; inspect only served styles.
            relative = target.relative_to(self.site)
            if relative.parts[0] not in {"styles", "_next"}:
                continue
            css = re.sub(r"/\*.*?\*/", "", target.read_text(encoding="utf-8"), flags=re.S)
            for match in CSS_URL.finditer(css):
                value = next(group for group in match.groups() if group is not None).strip()
                self.reference(value, self.base + relative.as_posix(), str(relative))

    def publication_scope(self):
        if self.base == "/" and not (self.site / ".pages-build").is_file():
            return
        forbidden = {"tools", "tests", "work", ".git"}
        for target in self.site.rglob("*"):
            relative = target.relative_to(self.site)
            self.require(not forbidden.intersection(relative.parts), f"Non-public directory included in deployment: {relative}")
            self.require(not target.name.startswith(".env"), f"Environment file included in deployment: {relative}")
        self.require((self.site / ".nojekyll").is_file(), "Deployment is missing .nojekyll")

    def run(self):
        if not self.require(self.site.is_dir(), f"Site directory does not exist: {self.site}"):
            return False
        self.pages()
        self.manifests()
        self.stylesheets()
        self.publication_scope()
        return not self.errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--site-dir", type=Path, default=ROOT)
    parser.add_argument("--base-path", default="/")
    arguments = parser.parse_args()
    if not re.fullmatch(r"/(?:[A-Za-z0-9_-]+/)*", arguments.base_path):
        parser.error("--base-path must start and end with / and contain URL path segments")
    check = IntegrityCheck(arguments.site_dir, arguments.base_path)
    if not check.run():
        for error in check.errors:
            print("FAIL:", error)
        raise SystemExit(1)
    counts = check.counts
    print(f"Passed: {arguments.base_path} — two pages, {counts['manifests']} manifests, "
          f"{counts['references']} local references, {counts['imports']} Flight imports, "
          f"{counts['text_records']} UTF-8 text records, and deployment scope.")
