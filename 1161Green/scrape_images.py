"""
Simple helper script to extract and download images from https://www.1166green.com/.

Usage (from the 1161Green directory):

    python scrape_images.py

This will:
  - Fetch the HTML from the source URL
  - Look for common image attributes (src, data-src, data-lazy, data-background)
  - Resolve them to absolute URLs
  - Download each image into ./images/

You may want to run this inside a virtual environment and install dependencies:

    pip install requests beautifulsoup4
"""

from __future__ import annotations

import os
import pathlib
from typing import Iterable, Set
from urllib.parse import urljoin, urlparse
import re

import requests
from bs4 import BeautifulSoup


SOURCE_URL = "https://www.1166green.com/"
OUTPUT_DIR = pathlib.Path(__file__).parent / "images"


def extract_image_urls(html: str, base_url: str) -> Set[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls: Set[str] = set()

    # Collect from <img> tags and some common lazy-loading attributes.
    candidates: Iterable[tuple[str, str]] = []
    for img in soup.find_all("img"):
        for attr in ("src", "data-src", "data-lazy", "data-background"):
            val = img.get(attr)
            if val:
                candidates.append((attr, val))

    # Also capture full-resolution URLs stored in data-ps-url (used by the photo gallery/lightbox).
    for el in soup.find_all(attrs={"data-ps-url": True}):
        val = el.get("data-ps-url")
        if val:
            candidates.append(("data-ps-url", val))

    # And capture background-image URLs declared inline on style attributes.
    bg_pattern = re.compile(r"background-image\s*:\s*url\(['\"]?(.*?)['\"]?\)", re.IGNORECASE)
    for el in soup.find_all(style=True):
        style_val = el.get("style") or ""
        match = bg_pattern.search(style_val)
        if match:
            candidates.append(("style", match.group(1)))

    for _, raw in candidates:
        raw = raw.strip()
        if not raw or raw.startswith("data:"):
            continue
        abs_url = urljoin(base_url, raw)
        urls.add(abs_url)

    return urls


def filename_for_url(url: str, index: int) -> str:
    parsed = urlparse(url)
    name = os.path.basename(parsed.path) or f"image_{index}"
    if "." not in name:
        # Default to .jpg if extension is missing.
        name = f"{name}.jpg"
    return name


def download_images(urls: Iterable[str], output_dir: pathlib.Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    for idx, url in enumerate(urls, start=1):
        # Prefer full-resolution variants where possible by rewriting known style prefixes.
        if "/styles/image_manage_preview/" in url:
            url = url.replace("/styles/image_manage_preview/", "/styles/kb_full/")

        dest = output_dir / filename_for_url(url, idx)

        try:
            print(f"Downloading {url} -> {dest} (overwriting if exists)")
            resp = requests.get(url, timeout=20)
            resp.raise_for_status()
        except Exception as exc:  # pragma: no cover - best-effort script
            print(f"  ! Failed to download {url}: {exc}")
            continue

        dest.write_bytes(resp.content)


def main() -> None:
    print(f"Fetching {SOURCE_URL} ...")
    resp = requests.get(SOURCE_URL, timeout=20)
    resp.raise_for_status()

    urls = sorted(extract_image_urls(resp.text, SOURCE_URL))
    print(f"Found {len(urls)} image URL(s).")
    if not urls:
        return

    download_images(urls, OUTPUT_DIR)
    print(f"Done. Images saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()

