"""Build a self-contained GitHub Pages site without changing local previews.

    python3 work/deploy/build-pages.py --base-path /eleven-portfolio/ --output-dir _site

Only runtime files are published. Python's standard library is sufficient.
"""

import argparse
import json
from pathlib import Path
import re
import runpy
import shutil

ROOT = Path(__file__).resolve().parents[2]
FLIGHT = re.compile(r"<script>self\.__next_f\.push\((.*?)\)</script>", re.S)


def json_text(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def build(output, base):
    # Generate both languages in memory using the normal content pipeline.
    source = runpy.run_path(str(ROOT / "work/i18n/build-site.py"))
    chinese = source["build"](source["refresh_versions"]((ROOT / "index.html").read_text()), "zh")
    pages = {"index.html": chinese, "en/index.html": source["build"](chinese, "en")}
    root_files = {p.name for p in ROOT.iterdir() if p.suffix in {".js", ".css"}}

    def path(value):
        if value == "/" or value.startswith("/#"):
            return base + value[1:]
        if value in {"/en", "/en/"}:
            return base + "en/"
        if value.startswith(("/assets/", "/_next/")):
            return base + value[1:]
        if value.startswith("/") and value[1:].split("?", 1)[0] in root_files:
            return base + value[1:]
        return value

    def walk(value):
        if isinstance(value, str):
            # Structured data also appears as a JSON string inside Flight.
            if value.startswith('{"@context":'):
                return json_text(walk(json.loads(value)))
            return path(value)
        if isinstance(value, list):
            return [walk(item) for item in value]
        if isinstance(value, dict):
            return {key: walk(item) for key, item in value.items()}
        return value

    def html(text, locale):
        blocks = list(FLIGHT.finditer(text))
        payloads = [json.loads(block[1]) for block in blocks]
        pending = None
        for index, payload in enumerate(payloads):
            if len(payload) < 2 or not isinstance(payload[1], str):
                continue
            if pending is not None:
                payload[1] = json_text(walk(json.loads(payload[1])))
                payloads[pending][1] = re.sub(r"T[0-9a-f]+,$", f'T{len(payload[1].encode("utf-8")):x},', payloads[pending][1])
                pending = None
                continue
            lines = []
            for line in payload[1].splitlines(keepends=True):
                key, separator, record = line.partition(":")
                # Import/preload records have a one- or two-letter tag before JSON.
                tagged = re.match(r"([A-Z]*)([\[{].*)", record, re.S)
                tag, body = (tagged[1], tagged[2]) if tagged else ("", record)
                try:
                    value = walk(json.loads(body))
                except json.JSONDecodeError:
                    lines.append(line)
                    continue
                if key == "0" and isinstance(value, dict) and "c" in value:
                    value["c"] = (base + ("en/" if locale == "en" else "")).split("/")
                    value["p"] = base.rstrip("/")
                lines.append(key + separator + tag + json_text(value) + ("\n" if line.endswith("\n") else ""))
            payload[1] = "".join(lines)
            if re.search(r":T[0-9a-f]+,$", payload[1]):
                pending = index
        if pending is not None:
            raise ValueError("Missing Flight text record")
        # Rewrite markup separately so Flight length prefixes remain accurate.
        parts = []
        start = 0
        for block, payload in zip(blocks, payloads):
            parts.append(markup(text[start:block.start()]))
            parts.append("<script>self.__next_f.push(" + json_text(payload) + ")</script>")
            start = block.end()
        parts.append(markup(text[start:]))
        return "".join(parts)

    def markup(text):
        return re.sub(r'(["\'])(/[^"\'\s<>]*)\1', lambda match: match[1] + path(match[2]) + match[1], text)

    def javascript(text, name):
        text = text.replace("/assets/", base + "assets/").replace("/_next/", base + "_next/")
        if name == "mirror-runtime.js":
            text = re.sub(r'(["\'])(/(?:en/)?)\1', lambda match: match[1] + path(match[2]) + match[1], text)
            text = text.replace("Path=/;", "Path=" + base + ";")
        if name.startswith("684-"):
            before = 'd=e=>{var t;return t=s&&"en"===e?"/articles":n,"en"===e?"/en".concat("/"===t?"":t):t}'
            after = 'd=e=>"en"===e?' + json_text(base + "en/") + ":" + json_text(base)
            if text.count(before) != 1:
                raise ValueError("Language component changed; review its Pages path adaptation")
            text = text.replace(before, after)
        return text

    # Refuse to clear an arbitrary directory when passed the wrong output path.
    if output.exists() and any(output.iterdir()) and not (output / ".pages-build").is_file():
        raise ValueError(f"Refusing to overwrite an unrecognized output directory: {output}")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    (output / ".pages-build").touch()
    (output / ".nojekyll").touch()
    for folder in ("assets", "_next"):
        shutil.copytree(ROOT / folder, output / folder, ignore=shutil.ignore_patterns(".DS_Store", "*.md"))
    for name in sorted(root_files):
        shutil.copy2(ROOT / name, output / name)
    for file in output.rglob("*"):
        if not file.is_file():
            continue
        if file.suffix == ".js":
            file.write_text(javascript(file.read_text(), file.name))
        elif file.suffix == ".css":
            file.write_text(file.read_text().replace("/assets/", base + "assets/"))
        elif file.suffix == ".json":
            file.write_text(json.dumps(walk(json.loads(file.read_text())), ensure_ascii=False, indent=2) + "\n")
    for name, text in pages.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html(text, "en" if name.startswith("en/") else "zh"))
    print(f"Built {sum(p.is_file() for p in output.rglob('*'))} files at {output} for {base}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-path", default="/eleven-portfolio/")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "_site")
    args = parser.parse_args()
    base = args.base_path
    if not re.fullmatch(r"/(?:[A-Za-z0-9_-]+/)*", base):
        parser.error("--base-path must start and end with / and contain only URL path segments")
    output = args.output_dir.resolve()
    if output == ROOT or ROOT.is_relative_to(output) or output.is_relative_to(ROOT / "assets") or output.is_relative_to(ROOT / "_next"):
        parser.error("--output-dir must be a dedicated build directory")
    build(output, base)
