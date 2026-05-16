from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = REPO_ROOT / "assets" / "images" / "products"
OUTPUTS = [
    ("medium", 900, 76),
    ("thumbs", 180, 68),
]


def is_source_image(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def convert_one(source: Path, output_dir: Path, size: int, quality: int) -> tuple[str, int, str | None]:
    target = output_dir / f"{source.stem}.jpg"
    if target.exists() and target.stat().st_size > 0 and target.stat().st_mtime >= source.stat().st_mtime:
        return "skipped", target.stat().st_size, None

    try:
        with Image.open(source) as image:
            image.seek(0)
            image = ImageOps.exif_transpose(image)
            image.thumbnail((size, size), Image.Resampling.LANCZOS)
            if image.mode in {"RGBA", "LA", "P"}:
                background = Image.new("RGB", image.size, "white")
                if image.mode == "P":
                    image = image.convert("RGBA")
                background.paste(image, mask=image.getchannel("A") if "A" in image.getbands() else None)
                image = background
            else:
                image = image.convert("RGB")
            image.save(target, "JPEG", quality=quality, optimize=True, progressive=True)
        return "created", target.stat().st_size, None
    except (UnidentifiedImageError, OSError, ValueError) as error:
        return "failed", 0, str(error)


def main() -> int:
    sources = sorted(path for path in SOURCE_DIR.iterdir() if is_source_image(path))
    print(f"Found {len(sources)} source product images.")

    failures = 0
    for folder, size, quality in OUTPUTS:
        output_dir = SOURCE_DIR / folder
        output_dir.mkdir(parents=True, exist_ok=True)
        created = skipped = total_bytes = 0
        print(f"Building {folder} images at max {size}px.")

        for index, source in enumerate(sources, start=1):
            status, byte_count, error = convert_one(source, output_dir, size, quality)
            total_bytes += byte_count
            if status == "created":
                created += 1
            elif status == "skipped":
                skipped += 1
            else:
                failures += 1
                print(f"FAILED {folder}/{source.name}: {error}")

            if index % 100 == 0 or index == len(sources):
                print(f"{folder}: {index}/{len(sources)} created={created} skipped={skipped} failed={failures}")

        print(f"{folder} done. created={created} skipped={skipped} bytes={total_bytes}")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
