"""Generate /en/ from the Chinese page and its matching Next Flight data.

Run from any directory: python3 work/i18n/build-site.py
Edit site translations in i18n/en.json; dialog copy lives in the dialog scripts.
Images and shared layout assets are reused unchanged.
"""

from copy import deepcopy
from html import escape, unescape
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
COPY = json.loads((ROOT / "i18n/en.json").read_text())
FLIGHT = re.compile(r"<script>self\.__next_f\.push\((.*?)\)</script>", re.S)
CJK = re.compile(r"[\u4e00-\u9fff]")
DESCRIPTION = "Eleven 的产品设计作品集，记录项目、Vibecoding 实验与工作经历。"
IMAGE_ALT = "Eleven — 产品设计作品集"


def json_text(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def translate(text):
    if text in COPY["text"]:
        return COPY["text"][text]
    if CJK.search(text) and text not in {"中", "中文"}:
        raise ValueError(f"Missing English translation: {text!r}")
    return text


def schema(locale):
    english = locale == "en"
    return {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "Person", "@id": "/#person", "name": "Ding Yi" if english else "丁祎",
             "alternateName": "Eleven", "url": "/", "jobTitle": "Product Designer" if english else "产品设计师",
             "image": "/assets/hero/eleven-apple-icon.png"},
            {"@type": "WebSite", "@id": "/#website", "name": "Eleven.doc",
             "url": "/en/" if english else "/", "description": translate(DESCRIPTION) if english else DESCRIPTION,
             "inLanguage": "en" if english else "zh-CN", "author": {"@id": "/#person"}},
        ],
    }


def walk(value, locale, experience=None):
    english = locale == "en"
    if isinstance(value, str):
        if value.startswith('{"@context":'):
            return json_text(walk(json.loads(value), locale))
        return translate(value) if english else value
    if isinstance(value, list):
        if english and value == ["locale", "zh", "d"]:
            return ["locale", "en", "d"]
        if len(value) == 4 and value[0] == "$" and isinstance(value[3], dict):
            props = value[3]
            classes = props.get("className", "").split()
            if "experience-card" in classes:
                experience = next(key for key in COPY["experienceDescriptions"] if key in classes)
            if english and props.get("className") == "experience-copy":
                for child in props.get("children", []):
                    if isinstance(child, list) and len(child) == 4 and child[1] == "p":
                        child[3]["children"] = COPY["experienceDescriptions"][experience]
            if value[1] == "html":
                props["lang"] = "en" if english else "zh-CN"
            if props.get("className") == "wordmark":
                props["children"] = "Eleven"
            if isinstance(props.get("messages"), dict) and english:
                props["messages"] = {
                    key: deepcopy(COPY["messages"][key]) if isinstance(messages, dict) else messages
                    for key, messages in props["messages"].items()
                }
            # Provider messages are already translated by namespace above.
            result = []
            for index, item in enumerate(value):
                if index == 3:
                    translated_props = {key: item_value if key == "messages" else walk(item_value, locale, experience)
                                        for key, item_value in item.items()}
                    if english and translated_props.get("locale") == "zh":
                        translated_props["locale"] = "en"
                    result.append(translated_props)
                else:
                    result.append(walk(item, locale, experience))
            return result
        return [walk(item, locale, experience) for item in value]
    if isinstance(value, dict):
        if value.get("@context") == "https://schema.org" and "@graph" in value:
            return schema(locale)
        result = {key: walk(item, locale, experience) for key, item in value.items()}
        if english and result.get("locale") == "zh":
            result["locale"] = "en"
        if english and result.get("c") == ["", "zh"]:
            result["c"] = ["", "en", ""]
        return result
    return value


def personalize(source):
    source = source.replace('<div class="wordmark" aria-hidden="true">oil</div>',
                            '<div class="wordmark" aria-hidden="true">Eleven</div>')
    replacements = {
        "Oil 的个人作品、AI 工具实操、产品开发与开源项目记录。": DESCRIPTION,
        "Oil — 产品、设计与开源作品": IMAGE_ALT,
        "Oil®": "Eleven",
        "https://www.oiloil.org/apple-icon.png": "/assets/hero/eleven-apple-icon.png",
        "https://www.oiloil.org/#person": "/#person",
        "https://www.oiloil.org/#website": "/#website",
        "https://www.oiloil.org/en": "/en/",
        "https://www.oiloil.org/": "/",
        "https://www.oiloil.org": "/",
    }
    for before, after in replacements.items():
        source = source.replace(before, after)
    return source


def refresh_versions(source):
    def version(match):
        path = ROOT / match[1].lstrip("/")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
        return match[1] + "?v=" + digest
    return re.sub(r'(?<=")(/[\w-]+\.(?:js|css))(?:\?v=[^"\s]+)?', version, source)


def rewrite_html(source, locale):
    if locale != "en":
        return source
    source = re.sub(r'(<article class="experience-card ([\w-]+)">.*?<div class="experience-copy">.*?)<p>.*?</p>',
                    lambda match: match[1] + "<p>" + escape(COPY["experienceDescriptions"][match[2]]) + "</p>",
                    source, flags=re.S)
    source = source.replace('<html lang="zh-CN">', '<html lang="en">')

    # Translate complete text nodes and attribute values, never substrings.
    source = re.sub(r'>([^<>]+)<', lambda match: ">" + escape(translate(unescape(match[1])), quote=False) + "<", source)
    source = re.sub(r'\b(aria-label|alt|content)="([^"]*)"',
                    lambda match: match[1] + '="' + escape(translate(unescape(match[2])), quote=True) + '"', source)
    source = source.replace('property="og:locale" content="zh_CN"', 'property="og:locale" content="en_US"')
    source = source.replace('property="og:locale:alternate" content="en_US"', 'property="og:locale:alternate" content="zh_CN"')
    source = re.sub(r'(<link rel="canonical" href=")[^"]*', r'\g<1>/en/', source)
    source = re.sub(r'(<meta property="og:url" content=")[^"]*', r'\g<1>/en/', source)

    def language_links(match):
        nav = match[0].replace(' aria-current="true"', '')
        return nav.replace('lang="en"', 'lang="en" aria-current="true"')

    return re.sub(r'<nav class="LanguageSwitch_[^"]+".*?</nav>', language_links, source, flags=re.S)


def build(source, locale):
    source = personalize(source)
    # SSR structured data and Flight structured data use the same object.
    source = re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)',
                    lambda match: match[1] + json_text(walk(json.loads(match[2]), locale)) + match[3], source, flags=re.S)
    blocks = list(FLIGHT.finditer(source))
    payloads = [json.loads(block[1]) for block in blocks]
    pending_text = None
    for index, payload in enumerate(payloads):
        if len(payload) < 2 or not isinstance(payload[1], str):
            continue
        content = payload[1]
        if pending_text is not None:
            # Next length-prefixed text records contain JSON-LD in this page.
            value = json.loads(content)
            payload[1] = json_text(walk(value, locale))
            previous = payloads[pending_text]
            previous[1] = re.sub(r'T[0-9a-f]+,$', f'T{len(payload[1].encode("utf-8")):x},', previous[1])
            pending_text = None
            continue
        lines = []
        for line in content.splitlines(keepends=True):
            key, separator, record = line.partition(":")
            try:
                value = json.loads(record)
            except json.JSONDecodeError:
                lines.append(line)
                continue
            result = walk(value, locale)
            # Local metadata has a language-specific canonical URL.
            if key == "9":
                for node in result.get("metadata", []):
                    if not isinstance(node, list) or len(node) != 4 or not isinstance(node[3], dict):
                        continue
                    props = node[3]
                    if props.get("rel") == "canonical":
                        props["href"] = "/en/" if locale == "en" else "/"
                    if props.get("property") == "og:url":
                        props["content"] = "/en/" if locale == "en" else "/"
                    if props.get("property") == "og:locale":
                        props["content"] = "en_US" if locale == "en" else "zh_CN"
                    if props.get("property") == "og:locale:alternate":
                        props["content"] = "zh_CN" if locale == "en" else "en_US"
            lines.append(key + separator + json_text(result) + ("\n" if line.endswith("\n") else ""))
        payload[1] = "".join(lines)
        if re.search(r':[T][0-9a-f]+,$', payload[1]):
            pending_text = index
    if pending_text is not None:
        raise ValueError("Missing Flight text record body")
    for match, payload in reversed(list(zip(blocks, payloads))):
        source = source[:match.start()] + "<script>self.__next_f.push(" + json_text(payload) + ")</script>" + source[match.end():]
    parts = re.split(r'(<script\b[^>]*>.*?</script>)', source, flags=re.S)
    source = "".join(part if part.startswith("<script") else rewrite_html(part, locale) for part in parts)
    return source


if __name__ == "__main__":
    chinese = build(refresh_versions((ROOT / "index.html").read_text()), "zh")
    english = build(chinese, "en")
    for locale, page in (("zh", chinese), ("en", english)):
        if page.count('class="project-trigger"') != 4:
            raise ValueError(f"{locale}: expected four project cards")
        if "https://www.oiloil.org" in page:
            raise ValueError(f"{locale}: original-site URL remains")
    (ROOT / "index.html").write_text(chinese)
    (ROOT / "en/index.html").write_text(english)
    print("Built Chinese / and English /en/ with matching SSR, messages, and Flight data.")
