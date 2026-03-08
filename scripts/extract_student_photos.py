from __future__ import annotations

import base64
import json
import sys
from typing import Any

import fitz  # PyMuPDF


def data_url(image_bytes: bytes, ext: str) -> str:
    mime = "jpeg" if ext.lower() in {"jpg", "jpeg"} else ext.lower()
    return f"data:image/{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"


def unique_images(images: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for img in images:
        if img and img not in seen:
            seen.add(img)
            out.append(img)
    return out


def score_candidate(
    left: float,
    top: float,
    width: float,
    height: float,
    pixel_width: int,
    pixel_height: int,
) -> float:
    if width < 0.08 or width > 0.24:
        return -1e9
    if height < 0.08 or height > 0.24:
        return -1e9
    if left < 0.68 or left > 0.90:
        return -1e9
    if top < 0.08 or top > 0.30:
        return -1e9

    ar = width / height if height else 0
    if ar < 0.45 or ar > 1.05:
        return -1e9

    pixel_ar = pixel_width / pixel_height if pixel_height else 0
    if pixel_ar <= 0 or pixel_ar > 0.95:
        return -1e9

    center_x = left + width / 2
    center_y = top + height / 2
    dx = abs(center_x - 0.835)
    dy = abs(center_y - 0.205)
    dw = abs(width - 0.145)
    dh = abs(height - 0.135)
    portrait_bonus = (0.95 - pixel_ar) * 350
    area_bonus = width * height * 800
    return 1000 - dx * 2600 - dy * 2600 - dw * 1400 - dh * 1400 + portrait_bonus + area_bonus


def is_right_side_portrait(img: dict[str, Any]) -> bool:
    left = float(img.get("left", 0))
    top = float(img.get("top", 0))
    width = float(img.get("width", 0))
    height = float(img.get("height", 0))
    pixel_width = int(img.get("pixelWidth", 0) or 0)
    pixel_height = int(img.get("pixelHeight", 0) or 0)

    if left < 0.68 or left > 0.90:
        return False
    if top < 0.08 or top > 0.32:
        return False
    if width < 0.08 or width > 0.24:
        return False
    if height < 0.08 or height > 0.24:
        return False
    if pixel_height <= 0 or pixel_width <= 0:
        return False
    return (pixel_width / pixel_height) < 0.95


def page_images(doc: fitz.Document, page: fitz.Page) -> list[dict[str, Any]]:
    rect = page.rect
    images: list[dict[str, Any]] = []
    seen_keys: set[tuple[int, tuple[float, float, float, float]]] = set()

    for info in page.get_image_info(xrefs=True):
        xref = int(info.get("xref", 0) or 0)
        bbox = info.get("bbox")
        if not xref or not bbox:
            continue

        r = fitz.Rect(bbox)
        key = (xref, (round(r.x0, 2), round(r.y0, 2), round(r.x1, 2), round(r.y1, 2)))
        if key in seen_keys:
            continue
        seen_keys.add(key)

        width = r.width / rect.width if rect.width else 0
        height = r.height / rect.height if rect.height else 0
        left = r.x0 / rect.width if rect.width else 0
        top = r.y0 / rect.height if rect.height else 0

        meta = doc.extract_image(xref)
        ext = meta.get("ext", "jpeg")
        image_bytes = meta.get("image", b"")
        if not image_bytes:
            continue

        images.append(
            {
                "xref": xref,
                "left": left,
                "top": top,
                "width": width,
                "height": height,
                "pixelWidth": int(meta.get("width", 0) or 0),
                "pixelHeight": int(meta.get("height", 0) or 0),
                "base64": data_url(image_bytes, ext),
            }
        )

        images[-1]["score"] = score_candidate(
            left,
            top,
            width,
            height,
            images[-1]["pixelWidth"],
            images[-1]["pixelHeight"],
        )

    return images


def extract(pdf_path: str) -> dict[str, Any]:
    doc = fitz.open(pdf_path)
    pages: list[dict[str, Any]] = []

    try:
        for index in range(doc.page_count):
            page = doc.load_page(index)
            imgs = page_images(doc, page)
            text = page.get_text("text")
            ranked_imgs = sorted(imgs, key=lambda img: img["score"], reverse=True)

            valid_ranked_imgs = [img for img in ranked_imgs if img["score"] > -1e8]
            best = valid_ranked_imgs[0] if valid_ranked_imgs else None

            if best is None:
                for img in ranked_imgs:
                    if is_right_side_portrait(img):
                        best = img
                        break

            if best is None:
                portrait_imgs = [img for img in imgs if is_right_side_portrait(img)]
                if portrait_imgs:
                    best = max(
                        portrait_imgs,
                        key=lambda img: (img["height"] * img["width"], img["pixelHeight"]),
                    )

            alternatives = unique_images([img["base64"] for img in ranked_imgs])
            pages.append(
                {
                    "pageNum": index + 1,
                    "text": text,
                    "photoBase64": best["base64"] if best else None,
                    "photoWidth": best["pixelWidth"] if best else 0,
                    "photoHeight": best["pixelHeight"] if best else 0,
                    "alternatives": alternatives,
                }
            )
    finally:
        doc.close()

    return {"totalPages": len(pages), "pages": pages}


if __name__ == "__main__":
    if len(sys.argv) not in {2, 3}:
        print(json.dumps({"error": "Usage: extract_student_photos.py <pdf_path> [output_json_path]"}))
        sys.exit(1)

    result = extract(sys.argv[1])
    payload = json.dumps(result)

    if len(sys.argv) == 3:
        with open(sys.argv[2], "w", encoding="utf-8") as f:
            f.write(payload)
    else:
        sys.stdout.write(payload)
