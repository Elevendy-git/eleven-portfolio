#!/usr/bin/env python3
"""Process separately exported Figma PNGs into local portfolio assets.

Usage (the bundled Codex Python includes Pillow):
  python3 tools/portfolio/sync_assets.py work/portfolio/export-plan.json
  python3 tools/portfolio/sync_assets.py --cover-only work/portfolio/export-plan.json

The JSON plan contains slug, title, source_dir, sections and optional period.
Each section contains id, title and frames (a list of source PNG filenames).
Optional cover contains frame and box [left, top, right, bottom]. Paths in
source_dir are relative to the plan file unless an absolute path is supplied.
cover.padding_after_export can contain top, bottom, left and right padding.
These are nonnegative integer pixels in the original cropped image's scale;
padding extends that crop's edge pixels before the cover is reduced in size.
An optional padding background RGB/RGBA array fills padding with that color
instead, for crops whose edge contains foreground imagery or shadows.
Full portfolio images retain their original dimensions and exact RGBA pixels.
Only the separate card cover and review sheets are reduced in resolution.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
IDENTIFIER = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
WEBP_MAX_DIMENSION = 16383


def png_filename(value: object) -> str:
    if not isinstance(value, str) or Path(value).name != value or Path(value).suffix.lower() != ".png":
        raise ValueError(f"Expected a PNG filename, got {value!r}")
    return value


def validate_plan(plan: dict) -> list[str]:
    if not isinstance(plan, dict) or not IDENTIFIER.fullmatch(str(plan.get("slug", ""))):
        raise ValueError("The plan needs a valid lowercase slug")
    if not isinstance(plan.get("title"), str) or not plan["title"].strip():
        raise ValueError("The plan needs a project title")
    if not isinstance(plan.get("source_dir"), str) or not plan["source_dir"]:
        raise ValueError("The plan needs source_dir")
    if "period" in plan and not isinstance(plan["period"], str):
        raise ValueError("period must be a string")
    sections = plan.get("sections")
    if not isinstance(sections, list) or not sections:
        raise ValueError("The plan needs at least one section")
    ids, frames = set(), []
    for section in sections:
        if not isinstance(section, dict) or not IDENTIFIER.fullmatch(str(section.get("id", ""))):
            raise ValueError("Each section needs a valid lowercase id")
        if section["id"] in ids:
            raise ValueError(f"Duplicate section id: {section['id']}")
        ids.add(section["id"])
        if not isinstance(section.get("title"), str) or not section["title"].strip():
            raise ValueError(f"Section {section['id']} needs a title")
        if not isinstance(section.get("frames"), list) or not section["frames"]:
            raise ValueError(f"Section {section['id']} needs frames")
        for value in section["frames"]:
            filename = png_filename(value)
            if filename not in frames:
                frames.append(filename)
    cover = plan.get("cover", {})
    if not isinstance(cover, dict):
        raise ValueError("cover must be an object")
    if "frame" in cover:
        png_filename(cover["frame"])
    return frames


def copy_original(source: Path, destination: Path) -> None:
    if source.resolve() != destination.resolve():
        shutil.copy2(source, destination)


def load_png(path: Path) -> Image.Image:
    with Image.open(path) as source:
        if source.format != "PNG":
            raise ValueError(f"Source is not PNG: {path}")
        source.load()
        return source.convert("RGBA")


def save_full_image(image: Image.Image, target_stem: Path) -> tuple[Path, bool]:
    """Lossless WebP where supported; preserve transparent RGB exactly too."""
    target = target_stem.with_suffix(".png" if max(image.size) > WEBP_MAX_DIMENSION else ".webp")
    # An opaque PNG does not need an alpha channel in the delivered file.
    opaque = image.getchannel("A").getextrema() == (255, 255)
    encoded = image.convert("RGB") if opaque else image
    if target.suffix == ".webp":
        encoded.save(target, lossless=True, exact=True, method=6)
    else:
        encoded.save(target, compress_level=9)
    with Image.open(target) as saved:
        saved.load()
        if saved.size != image.size:
            raise ValueError(f"Dimensions changed while encoding {target}")
        difference = ImageChops.difference(image, saved.convert("RGBA"))
        identical = all(extrema == (0, 0) for extrema in difference.getextrema())
    if not identical:
        raise ValueError(f"Lossless pixel verification failed: {target}")
    return target, opaque


def default_cover_box(width: int, height: int) -> tuple[int, int, int, int]:
    desired_height = round(width * 10 / 16)
    if desired_height <= height:
        return (0, 0, width, desired_height)
    # A source shorter than 16:10 uses its full height and a centered width crop.
    desired_width = min(width, round(height * 16 / 10))
    left = (width - desired_width) // 2
    return (left, 0, left + desired_width, height)


def validate_box(value: object, image: Image.Image) -> tuple[int, int, int, int]:
    if not isinstance(value, (list, tuple)) or len(value) != 4 or any(type(n) is not int for n in value):
        raise ValueError("cover.box must contain four integer coordinates")
    left, top, right, bottom = value
    if not (0 <= left < right <= image.width and 0 <= top < bottom <= image.height):
        raise ValueError(f"cover.box {value!r} falls outside {image.size}")
    return left, top, right, bottom


def pad_cover_edges(image: Image.Image, value: object) -> tuple[Image.Image, dict | None]:
    if value is None:
        return image.copy(), None
    if not isinstance(value, dict):
        raise ValueError("cover.padding_after_export must be an object")
    padding = {side: value.get(side, 0) for side in ("top", "bottom", "left", "right")}
    if any(type(amount) is not int or amount < 0 for amount in padding.values()):
        raise ValueError("Cover padding must use nonnegative integer source pixels")
    top, bottom, left, right = (padding[side] for side in ("top", "bottom", "left", "right"))
    width, height = image.size
    background = value.get("background")
    if background is not None:
        if not isinstance(background, (list, tuple)) or len(background) not in (3, 4) or any(
            type(channel) is not int or not 0 <= channel <= 255 for channel in background
        ):
            raise ValueError("Cover padding background must be an RGB or RGBA byte array")
        background = tuple(background) + ((255,) if len(background) == 3 else ())
    canvas = Image.new("RGBA", (width + left + right, height + top + bottom), background)
    canvas.paste(image, (left, top))
    strips = (
        (top, (0, 0, width, 1), (width, top), (left, 0)),
        (bottom, (0, height - 1, width, height), (width, bottom), (left, top + height)),
        (left, (0, 0, 1, height), (left, height), (0, top)),
        (right, (width - 1, 0, width, height), (right, height), (left + width, top)),
    )
    for amount, box, size, position in strips:
        if amount and background is None:
            strip = image.crop(box).resize(size, Image.Resampling.NEAREST)
            canvas.paste(strip, position)
            strip.close()
    corners = (
        (left, top, (0, 0), image.getpixel((0, 0))),
        (right, top, (left + width, 0), image.getpixel((width - 1, 0))),
        (left, bottom, (0, top + height), image.getpixel((0, height - 1))),
        (right, bottom, (left + width, top + height), image.getpixel((width - 1, height - 1))),
    )
    for corner_width, corner_height, position, color in corners:
        if corner_width and corner_height and background is None:
            corner = Image.new("RGBA", (corner_width, corner_height), color)
            canvas.paste(corner, position)
            corner.close()
    difference = ImageChops.difference(image, canvas.crop((left, top, left + width, top + height)))
    if any(extrema != (0, 0) for extrema in difference.getextrema()):
        raise ValueError("Cover padding changed pixels inside the source crop")
    padding.update(method="fill specified background color" if background is not None else "extend cropped image edge pixels",
                   source_placement=[left, top])
    if background is not None:
        padding["background"] = list(background)
    return canvas, padding


def build_cover(plan: dict, source_dir: Path, originals: Path, assets: Path, first_frame: str) -> dict:
    cover = plan.get("cover", {})
    filename = cover.get("frame", first_frame)
    copy_original(source_dir / filename, originals / filename)
    image = load_png(originals / filename)
    box = validate_box(cover.get("box", default_cover_box(*image.size)), image)
    cropped = image.crop(box)
    thumbnail, padding = pad_cover_edges(cropped, cover.get("padding_after_export"))
    canvas_size = list(thumbnail.size)
    if thumbnail.width > 1600:
        reduced = thumbnail.resize((1600, round(thumbnail.height * 1600 / thumbnail.width)), Image.Resampling.LANCZOS)
        thumbnail.close()
        thumbnail = reduced
    target = assets / "cover.webp"
    thumbnail.save(target, quality=95, method=6, exact=True)
    result = dict(frame=filename, box=list(box), asset=f"/assets/{plan['slug']}/cover.webp",
                  width=thumbnail.width, height=thumbnail.height, bytes=target.stat().st_size)
    if padding is not None:
        result.update(padding=padding, canvas_size_before_resize=canvas_size,
                      source_pixels_preserved_before_resize=True)
    image.close()
    cropped.close()
    thumbnail.close()
    return result


def review_sheets(frames: list[str], originals: Path) -> None:
    columns = min(4, len(frames))
    rows = math.ceil(len(frames) / columns)
    overview = Image.new("RGB", (columns * 360, rows * 720), "#eeeeee")
    headers = Image.new("RGB", (columns * 360, rows * 460), "#eeeeee")
    for index, filename in enumerate(frames):
        source = load_png(originals / filename)
        # White backing keeps transparent exported content visible for review.
        rendered = Image.new("RGB", source.size, "white")
        rendered.paste(source, mask=source.getchannel("A"))
        whole = rendered.copy()
        whole.thumbnail((340, 660), Image.Resampling.LANCZOS)
        head = rendered.crop((0, 0, rendered.width, min(rendered.height, round(rendered.width * 1.25))))
        head.thumbnail((340, 420), Image.Resampling.LANCZOS)
        column, row = index % columns, index // columns
        for canvas, preview, cell_height in ((overview, whole, 720), (headers, head, 460)):
            x, y = column * 360, row * cell_height
            draw = ImageDraw.Draw(canvas)
            draw.text((x + 10, y + 8), f"{index + 1:02} {filename}", fill="#222222")
            canvas.paste(preview, (x + 10 + (340 - preview.width) // 2, y + 32))
        source.close()
        rendered.close()
        whole.close()
        head.close()
    overview.save(originals / "frame-overview.jpg", quality=95)
    headers.save(originals / "frame-headers.jpg", quality=95)


def process_plan(plan_path: Path, cover_only: bool = False) -> None:
    plan = json.loads(plan_path.read_text())
    frames = validate_plan(plan)
    source_dir = Path(plan["source_dir"]).expanduser()
    if not source_dir.is_absolute():
        source_dir = plan_path.parent / source_dir
    source_dir = source_dir.resolve()
    originals = ROOT / "work" / plan["slug"] / "frames-2x"
    assets = ROOT / "assets" / plan["slug"]
    originals.mkdir(parents=True, exist_ok=True)
    assets.mkdir(parents=True, exist_ok=True)
    if cover_only:
        cover_filename = plan.get("cover", {}).get("frame", frames[0])
        # Prefer the saved original so cover-only does not rewrite other files.
        cover_source = originals if (originals / cover_filename).is_file() else source_dir
        if not (cover_source / cover_filename).is_file():
            raise FileNotFoundError(cover_source / cover_filename)
        cover = build_cover(plan, cover_source, originals, assets, frames[0])
        report_path = originals / "verification.json"
        report = json.loads(report_path.read_text()) if report_path.is_file() else dict(
            project=plan["slug"], title=plan["title"], images=[])
        report["cover"] = cover
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(dict(project=plan["slug"], cover_only=True, cover=cover), ensure_ascii=False), flush=True)
        return
    required = set(frames) | {plan.get("cover", {}).get("frame", frames[0])}
    for filename in required:
        if not (source_dir / filename).is_file():
            raise FileNotFoundError(source_dir / filename)
    image_specs, verification = {}, []
    for index, filename in enumerate(frames, 1):
        copy_original(source_dir / filename, originals / filename)
        image = load_png(originals / filename)
        target, opaque = save_full_image(image, assets / f"frame-{index:02}-2x")
        image_specs[filename] = dict(src=f"/assets/{plan['slug']}/{target.name}", width=image.width, height=image.height)
        verification.append(dict(frame=filename, **image_specs[filename], bytes=target.stat().st_size,
                                 opaque=opaque, pixels_identical=True))
        image.close()
        print(json.dumps(verification[-1], ensure_ascii=False), flush=True)
    sections = []
    for source_section in plan["sections"]:
        section = dict(id=source_section["id"], title=source_section["title"])
        section_images = [image_specs[filename].copy() for filename in source_section["frames"]]
        if len(section_images) == 1:
            section.update(section_images[0])
        else:
            section["pages"] = section_images
        sections.append(section)
    manifest = dict(title=plan["title"], sections=sections)
    if plan.get("period"):
        manifest["period"] = plan["period"]
    cover = build_cover(plan, source_dir, originals, assets, frames[0])
    review_sheets(frames, originals)
    (assets / "portfolio-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    report = dict(project=plan["slug"], title=plan["title"], images=verification, cover=cover)
    (originals / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(dict(project=plan["slug"], chapters=len(sections), images=len(frames),
                         full_image_bytes=sum(item["bytes"] for item in verification),
                         manifest=str(assets / "portfolio-manifest.json")), ensure_ascii=False), flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("plan", type=Path, help="Path to one project's export-plan JSON")
    parser.add_argument("--cover-only", action="store_true", help="Rebuild only cover.webp and its verification record")
    arguments = parser.parse_args()
    process_plan(arguments.plan.resolve(), cover_only=arguments.cover_only)


if __name__ == "__main__":
    main()
