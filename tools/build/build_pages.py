"""Build the static site for GitHub Pages without changing local previews.

    python3 tools/build/build_pages.py --base-path /eleven-portfolio/ --output-dir _site

Only runtime files are published. Python's standard library is sufficient.
"""

import argparse
import json
from pathlib import Path
import re
import shutil

from build_site import build as build_language, refresh_versions
from flight import json_text, transform_flight

ROOT = Path(__file__).resolve().parents[2]
PUBLIC_FOLDERS = ("assets", "_next", "scripts", "styles")


def build(output, base):
    chinese = build_language(refresh_versions((ROOT / "index.html").read_text()), "zh")
    pages = {"index.html": chinese, "en/index.html": build_language(chinese, "en")}

    def path(value):
        if value == "/" or value.startswith("/#"):
            return base + value[1:]
        if value in {"/en", "/en/"}:
            return base + "en/"
        if value.startswith(tuple("/" + folder + "/" for folder in PUBLIC_FOLDERS)):
            return base + value[1:]
        return value

    def walk(value):
        if isinstance(value, str):
            if value.startswith('{"@context":'):
                return json_text(walk(json.loads(value)))
            return path(value)
        if isinstance(value, list):
            return [walk(item) for item in value]
        if isinstance(value, dict):
            return {key: walk(item) for key, item in value.items()}
        return value

    def html(text, locale):
        def record(value, key):
            value = walk(value)
            if key == "0" and isinstance(value, dict) and "c" in value:
                value["c"] = (base + ("en/" if locale == "en" else "")).split("/")
                value["p"] = base.rstrip("/")
            return value

        def markup(text):
            return re.sub(r'(["\'])(/[^"\'\s<>]*)\1', lambda match: match[1] + path(match[2]) + match[1], text)

        return transform_flight(text, record, markup)

    def javascript(text, name):
        text = text.replace("/assets/", base + "assets/").replace("/_next/", base + "_next/")
        if name == "language-switch.js":
            text = re.sub(r'(["\'])(/(?:en/)?)\1', lambda match: match[1] + path(match[2]) + match[1], text)
            text = text.replace("Path=/;", "Path=" + base + ";")
        if name.startswith("684-"):
            before = 'd=e=>{var t;return t=s&&"en"===e?"/articles":n,"en"===e?"/en".concat("/"===t?"":t):t}'
            after = 'd=e=>"en"===e?' + json_text(base + "en/") + ":" + json_text(base)
            if text.count(before) != 1:
                raise ValueError("Language component changed; review its Pages path adaptation")
            text = text.replace(before, after)
        return text

    if output.exists() and any(output.iterdir()) and not (output / ".pages-build").is_file():
        raise ValueError(f"Refusing to overwrite an unrecognized output directory: {output}")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    (output / ".pages-build").touch()
    (output / ".nojekyll").touch()
    for folder in PUBLIC_FOLDERS:
        shutil.copytree(ROOT / folder, output / folder, ignore=shutil.ignore_patterns(".DS_Store", "*.md"))
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
    source_folders = PUBLIC_FOLDERS + ("en", "i18n", "tools", "tests", ".git", "work")
    if ROOT.is_relative_to(output) or any(output.is_relative_to(ROOT / folder) for folder in source_folders):
        parser.error("--output-dir must be a dedicated build directory")
    build(output, base)
