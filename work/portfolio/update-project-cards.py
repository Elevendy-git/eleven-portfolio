"""Update portfolio cards in both the static HTML and Next Flight data.

Usage: python3 work/portfolio/update-project-cards.py path/to/cards.json
The plan has a `cards` array for card numbers 2, 3, and 4. This script keeps
card 1, removes cards 5–7, and does not add or change head resources.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re


def element(tag, attributes=None, children=None):
    properties = dict(attributes or {})
    if children is not None:
        properties["children"] = children
    return ["$", tag, None, properties]


def render(value):
    if isinstance(value, str):
        return escape(value)
    if not isinstance(value, list):
        return ""
    if len(value) != 4 or value[0] != "$":
        return "".join(render(child) for child in value)
    _, tag, _, properties = value
    attributes = []
    for key, attribute in properties.items():
        if key == "children":
            continue
        key = {"className": "class"}.get(key, key)
        if isinstance(attribute, bool):
            attribute = str(attribute).lower()
        attributes.append(f' {key}="{escape(str(attribute), quote=True)}"')
    opening = "<" + tag + "".join(attributes)
    if tag == "img":
        return opening + "/>"
    return opening + ">" + render(properties.get("children", [])) + "</" + tag + ">"


def build_children(card):
    cover = card["cover"]
    heading = []
    if card.get("logo"):
        logo = card["logo"]
        heading.append(element("span", {"className": "pbrand", "aria-hidden": "true"},
                               element("img", {"src": logo["src"], "width": logo["width"],
                                               "height": logo["height"], "alt": "",
                                               "loading": "lazy", "decoding": "async"})))
    title_attributes = {"lang": "en"} if card["title"].isascii() else None
    heading.append(element("h3", title_attributes, card["title"]))
    information = [element("div", {"className": "ptitle"}, heading)]
    if card["meta"]:
        information.append(element("div", {"className": "portfolio-card-meta"}, card["meta"]))
    information.append(element("p", None, card["description"]))
    return [
        element("span", {"className": "pnum", "aria-hidden": "true"}, f"{card['number']:02d}"),
        element("div", {"className": "stage"},
                element("div", {"className": "portfolio-cover", "aria-hidden": "true"},
                        element("img", {"className": "portfolio-cover-image", "src": cover["src"],
                                        "width": cover["width"], "height": cover["height"], "alt": "",
                                        "loading": "lazy", "decoding": "async", "draggable": False}))),
        element("div", {"className": "pinfo"}, element("div", {"className": "pinfo-main"}, information)),
        element("a", {"className": "project-trigger", "href": card["url"], "target": "_blank",
                      "rel": "noopener noreferrer", "data-project-open": card["id"],
                      "aria-haspopup": "dialog", "aria-controls": "project-dialog",
                      "aria-label": f"查看 {card['title']} 完整作品集"}),
    ]


class CardSpans(HTMLParser):
    """Track complete div wrappers without relying on a following card."""

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.line_starts = [0]
        self.line_starts.extend(match.end() for match in re.finditer("\n", source))
        self.stack = []
        self.cards = {}
        self.wrappers = {}

    def source_offset(self):
        line, column = self.getpos()
        return self.line_starts[line - 1] + column

    def handle_starttag(self, tag, attributes):
        if tag == "div":
            self.stack.append({"start": self.source_offset(), "attributes": dict(attributes)})

    def handle_endtag(self, tag):
        if tag != "div" or not self.stack:
            return
        node = self.stack.pop()
        end = self.source_offset() + len("</div>")
        identifier = node["attributes"].get("id", "")
        match = re.fullmatch(r"product-(\d\d)", identifier)
        if match:
            number = int(match.group(1))
            if number in self.cards:
                raise ValueError(f"Duplicate SSR card: {identifier}")
            self.cards[number] = (node["start"], end)
            if not self.stack or "card-hitbox" not in self.stack[-1]["attributes"].get("class", "").split():
                raise ValueError(f"Missing SSR card wrapper: {identifier}")
            self.stack[-1]["card_number"] = number
        if "card_number" in node:
            self.wrappers[node["card_number"]] = (node["start"], end)


class CardInformation(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = []
        self.paragraphs = []
        self.url = None
        self.collecting = None

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag == "h3":
            self.collecting = self.title
        elif tag == "p":
            self.paragraphs.append([])
            self.collecting = self.paragraphs[-1]
        elif tag == "a" and attributes.get("data-project-open") == "delysium":
            self.url = attributes.get("href")

    def handle_endtag(self, tag):
        if tag in {"h3", "p"}:
            self.collecting = None

    def handle_data(self, data):
        if self.collecting is not None:
            self.collecting.append(data)


def json_text(value):
    # Keep script contents safe even when a description contains an HTML tag.
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def validate_plan(plan):
    cards = plan.get("cards")
    if not isinstance(cards, list) or len(cards) != 3:
        raise ValueError("Plan must contain three cards numbered 2, 3, and 4")
    if {card.get("number") for card in cards} != {2, 3, 4}:
        raise ValueError("Card numbers must be exactly 2, 3, and 4")
    identifiers = set()
    for card in cards:
        for key in ("id", "title", "meta", "description", "url"):
            if not isinstance(card.get(key), str):
                raise ValueError(f"Card {card['number']}: {key} must be a string")
        if not re.fullmatch(r"[a-z0-9-]+", card["id"]) or card["id"] in identifiers:
            raise ValueError("Project IDs must be unique lowercase names")
        identifiers.add(card["id"])
        if not card["url"].startswith("https://"):
            raise ValueError("Project URLs must use HTTPS")
        for key in ("cover", "logo"):
            image = card.get(key)
            if key == "logo" and image is None:
                continue
            if not isinstance(image, dict) or not isinstance(image.get("src"), str):
                raise ValueError(f"Card {card['number']}: {key} must specify src, width, and height")
            if not image["src"].startswith("/") or ".." in image["src"]:
                raise ValueError("Image paths must be absolute site paths")
            if not all(isinstance(image.get(size), (int, float)) and image[size] > 0 for size in ("width", "height")):
                raise ValueError("Image dimensions must be positive")
    return sorted(cards, key=lambda card: card["number"])


def update(source, cards):
    spans = CardSpans(source)
    spans.feed(source)
    if not all(number in spans.cards for number in (1, 2, 3, 4)):
        raise ValueError("Expected SSR product cards 01–04")
    first = CardInformation()
    start, end = spans.cards[1]
    first.feed(source[start:end])
    if not first.url or not first.paragraphs:
        raise ValueError("Could not read the current Delysium title, description, and URL")
    first_metadata = {
        "title": "".join(first.title).strip(),
        "description": "".join(first.paragraphs[-1]).strip(),
        "url": first.url,
    }
    children = {card["number"]: build_children(card) for card in cards}
    replacements = []
    for number, content in children.items():
        start, end = spans.cards[number]
        old = source[start:end]
        opening = old[:old.index(">") + 1]
        replacements.append((start, end, opening + render(content) + "</div>"))
    removed = []
    for number in (5, 6, 7):
        if number in spans.wrappers:
            start, end = spans.wrappers[number]
            replacements.append((start, end, ""))
            removed.append(number)
    start, end = spans.cards[1]
    first_html, control_count = re.subn(
        r'aria-controls="[^"]+"', 'aria-controls="project-dialog"', source[start:end])
    if control_count != 1:
        raise ValueError("Expected one dialog trigger on the Delysium card")
    replacements.append((start, end, first_html))
    for start, end, replacement in sorted(replacements, reverse=True):
        source = source[:start] + replacement + source[end:]

    flight_cards = {2: 0, 3: 0, 4: 0}
    first_controls = 0
    panels = 0

    def walk(value):
        nonlocal first_controls, panels
        changed = False
        if isinstance(value, list):
            if len(value) == 4 and value[0] == "$" and isinstance(value[3], dict):
                properties = value[3]
                identifier = properties.get("id") or ""
                match = re.fullmatch(r"product-0([234])", identifier)
                if match:
                    number = int(match.group(1))
                    properties["children"] = deepcopy(children[number])
                    flight_cards[number] += 1
                    return True
                if identifier == "panel-products":
                    panel_children = properties.get("children")
                    if not isinstance(panel_children, list) or len(panel_children) < 2 or not isinstance(panel_children[1], list):
                        raise ValueError("Unexpected Flight product panel shape")
                    panel_children[1] = [child for child in panel_children[1]
                                         if not isinstance(child, str) or child not in {"$L33", "$L34", "$L35"}]
                    panels += 1
                    changed = True
                if properties.get("data-project-open") == "delysium":
                    properties["aria-controls"] = "project-dialog"
                    first_controls += 1
                    changed = True
            for child in value:
                changed = walk(child) or changed
        elif isinstance(value, dict):
            for child in value.values():
                changed = walk(child) or changed
        return changed

    def update_flight(match):
        payload = json.loads(match.group(1))
        if len(payload) <= 1 or not isinstance(payload[1], str):
            return match.group(0)
        changed = False
        lines = []
        for line in payload[1].splitlines(keepends=True):
            key, separator, record = line.partition(":")
            if not separator:
                lines.append(line)
                continue
            try:
                value = json.loads(record)
            except json.JSONDecodeError:
                lines.append(line)
                continue
            if key in {"33", "34", "35"}:
                if value is not None and not (isinstance(value, list) and len(value) == 4
                                             and isinstance(value[3], dict)
                                             and value[3].get("id") in {"product-05", "product-06", "product-07"}):
                    raise ValueError(f"Flight record {key} is no longer a removable product card")
                value = None
                record_changed = True
            else:
                record_changed = walk(value)
            if record_changed:
                ending = "\n" if line.endswith("\n") else ""
                line = key + ":" + json_text(value) + ending
                changed = True
            lines.append(line)
        if not changed:
            return match.group(0)
        payload[1] = "".join(lines)
        return "<script>self.__next_f.push(" + json_text(payload) + ")</script>"

    source = re.sub(r"<script>self\.__next_f\.push\((.*?)\)</script>", update_flight, source, flags=re.DOTALL)
    if flight_cards != {2: 1, 3: 1, 4: 1} or first_controls != 1 or panels != 1:
        raise ValueError(f"Unexpected Flight matches: cards={flight_cards}, first={first_controls}, panels={panels}")

    metadata_cards = [first_metadata] + cards
    item_list_count = 0

    def build_item_list(value):
        value = deepcopy(value)
        value["itemListElement"] = [
            {"@type": "ListItem", "position": position,
             "item": {"@type": "CreativeWork", "name": card["title"],
                      "description": card["description"], "url": card["url"]}}
            for position, card in enumerate(metadata_cards, 1)
        ]
        return value

    # Next stores the ItemList in a length-prefixed Flight text record. Its
    # header and contents are separate pushes; both must match the SSR script.
    flight_blocks = list(re.finditer(r"<script>self\.__next_f\.push\((.*?)\)</script>", source, flags=re.DOTALL))
    flight_payloads = [json.loads(block.group(1)) for block in flight_blocks]
    text_changes = {}
    flight_item_lists = 0
    for index, payload in enumerate(flight_payloads):
        if len(payload) <= 1 or not isinstance(payload[1], str):
            continue
        try:
            value = json.loads(payload[1])
        except json.JSONDecodeError:
            continue
        if not isinstance(value, dict) or value.get("@type") != "ItemList":
            continue
        if index == 0:
            raise ValueError("Missing Flight ItemList text header")
        previous = flight_payloads[index - 1]
        if len(previous) <= 1 or not isinstance(previous[1], str):
            raise ValueError("Unexpected Flight ItemList text header")
        header = re.search(r"([0-9a-f]+):T([0-9a-f]+),$", previous[1])
        if header is None or int(header.group(2), 16) != len(payload[1].encode("utf-8")):
            raise ValueError("Flight ItemList text byte length does not match its header")
        payload[1] = json_text(build_item_list(value))
        previous[1] = (previous[1][:header.start(2)]
                       + format(len(payload[1].encode("utf-8")), "x")
                       + previous[1][header.end(2):])
        text_changes[index - 1] = previous
        text_changes[index] = payload
        flight_item_lists += 1
    if flight_item_lists != 1:
        raise ValueError(f"Expected one Flight project ItemList, found {flight_item_lists}")
    for index in sorted(text_changes, reverse=True):
        block = flight_blocks[index]
        replacement = "<script>self.__next_f.push(" + json_text(text_changes[index]) + ")</script>"
        source = source[:block.start()] + replacement + source[block.end():]

    def update_item_list(match):
        nonlocal item_list_count
        value = json.loads(match.group(1))
        if not isinstance(value, dict) or value.get("@type") != "ItemList":
            return match.group(0)
        value = build_item_list(value)
        item_list_count += 1
        return '<script type="application/ld+json">' + json_text(value) + "</script>"

    source = re.sub(r'<script type="application/ld\+json">(.*?)</script>', update_item_list, source, flags=re.DOTALL)
    if item_list_count != 1:
        raise ValueError(f"Expected one project ItemList, found {item_list_count}")
    final_spans = CardSpans(source)
    final_spans.feed(source)
    if set(final_spans.cards) != {1, 2, 3, 4}:
        raise ValueError("SSR card removal was incomplete")
    return source, {"cards": 4, "updated": [2, 3, 4], "removed": removed,
                    "flight_cards": flight_cards, "item_list_projects": 4,
                    "flight_item_list_projects": 4}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", type=Path, help="JSON plan containing cards 2, 3, and 4")
    parser.add_argument("--index", type=Path,
                        default=Path(__file__).resolve().parents[2] / "index.html")
    arguments = parser.parse_args()
    cards = validate_plan(json.loads(arguments.plan.read_text()))
    result, report = update(arguments.index.read_text(), cards)
    arguments.index.write_text(result)
    report["index"] = str(arguments.index.resolve())
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
