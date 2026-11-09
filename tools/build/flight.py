"""Transform embedded Next Flight data and keep text record byte lengths valid."""

import json
import re

SCRIPTS = re.compile(r"<script>self\.__next_f\.push\((.*?)\)</script>", re.S)


def json_text(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def transform_flight(source, transform, markup=lambda text: text):
    """Apply transform(value, record_id) to JSON, import and preload records.

    Text records have a T<hex-length>, header in one payload and their body in
    the next. Their length is recalculated after changing the body. Unknown
    Flight record types are preserved. Optional markup handles gaps outside
    these scripts, so URL rewriting cannot invalidate text record lengths.
    """
    blocks = list(SCRIPTS.finditer(source))
    payloads = [json.loads(block[1]) for block in blocks]
    pending = None
    for index, payload in enumerate(payloads):
        if len(payload) < 2 or not isinstance(payload[1], str):
            continue
        if pending is not None:
            previous_index, key = pending
            payload[1] = json_text(transform(json.loads(payload[1]), key))
            previous = payloads[previous_index]
            previous[1] = re.sub(r"T[0-9a-f]+,$", f'T{len(payload[1].encode("utf-8")):x},', previous[1])
            pending = None
            continue
        lines = []
        for line in payload[1].splitlines(keepends=True):
            key, separator, record = line.partition(":")
            header = re.fullmatch(r"T[0-9a-f]+,", record)
            if header:
                pending = (index, key)
                lines.append(line)
                continue
            tagged = re.match(r"([A-Z]*)([\[{].*)", record, re.S)
            tag, body = (tagged[1], tagged[2]) if tagged else ("", record)
            try:
                value = json.loads(body)
            except json.JSONDecodeError:
                lines.append(line)
                continue
            lines.append(key + separator + tag + json_text(transform(value, key)) + ("\n" if line.endswith("\n") else ""))
        payload[1] = "".join(lines)
    if pending is not None:
        raise ValueError("Missing Flight text record body")
    result = []
    start = 0
    for block, payload in zip(blocks, payloads):
        result.append(markup(source[start:block.start()]))
        result.append("<script>self.__next_f.push(" + json_text(payload) + ")</script>")
        start = block.end()
    result.append(markup(source[start:]))
    return "".join(result)
