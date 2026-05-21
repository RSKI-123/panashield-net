import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_JSON = ROOT / "assets" / "data" / "products.json"
OUTPUT_DIR = ROOT / "assets" / "images" / "home"
LOGO_PATH = ROOT / "assets" / "images" / "risukai-logo-rectangle.png"
FONT_BOLD = Path("C:/Windows/Fonts/NotoSansJP-VF.ttf")
FONT_REGULAR = Path("C:/Windows/Fonts/NotoSansJP-VF.ttf")

CHARGE_TERMS = [
    "充電",
    "充電器",
    "充電式",
    "ケーブル",
    "ワイヤレス",
    "アダプター",
    "コンセント",
    "Type-C",
    "type-c",
    "USB",
    "PD",
    "Lightning",
    "ライトニング",
    "急速",
    "電源",
    "バッテリー",
]

CHARGE_GROUPS = {
    "fast": ["k35-a01", "k47-a01", "k03-k35-a01", "k06-a01"],
    "cable": ["s02-c01", "s15-a01", "t824-c01", "s02-a01"],
    "wireless": ["wh-k39-a01", "wh-k47-a01", "wh-qa1", "wh-qa2"],
    "car": ["k04-a01", "k04-b01", "m22-a01"],
    "daily": ["ksd-a01", "xdm-a01", "i3-a01", "washer-a01"],
    "emergency": ["syj-090-a01", "g2403-a01", "fd-2026-c01"],
}


def load_products():
    products = json.loads(PRODUCTS_JSON.read_text(encoding="utf-8"))["products"]
    return {item["managementNumber"]: item for item in products}


def product_text(product):
    values = [
        product.get("managementNumber", ""),
        product.get("name", ""),
        product.get("tagline", ""),
        product.get("category", ""),
        product.get("storeName", ""),
    ]
    for spec in product.get("specs", []):
        values.extend([spec.get("label", ""), spec.get("value", "")])
    for variant in product.get("variants", []):
        values.extend([variant.get("label", ""), variant.get("sku", ""), variant.get("merchantSku", "")])
    return " ".join(str(value) for value in values if value)


def rechargeable_product_ids(products):
    ids = []
    for item_id, product in products.items():
        text = product_text(product)
        if any(term in text for term in CHARGE_TERMS) and product_image(product):
            ids.append(item_id)
    return ids


def unique_ids(*groups):
    ids = []
    for group in groups:
        for item_id in group:
            if item_id not in ids:
                ids.append(item_id)
    return ids


def pick(products, ids, fallback=None, limit=None):
    fallback = fallback or []
    picked = []
    for item_id in unique_ids(ids, fallback):
        product = products.get(item_id)
        if product and product_image(product):
            picked.append(item_id)
        if limit and len(picked) >= limit:
            break
    return picked


def product_image(product):
    for key in ("mainImage", "whiteBgImage"):
        value = product.get(key)
        if value:
            path = ROOT / value
            if path.exists():
                return path
    for value in product.get("images", []):
        path = ROOT / value
        if path.exists():
            return path
    return None


def open_image(path):
    image = Image.open(path)
    if getattr(image, "is_animated", False):
        image.seek(0)
    return image.convert("RGB")


def cover(image, size):
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def contain(image, size, bg=(255, 255, 255)):
    canvas = Image.new("RGB", size, bg)
    fitted = ImageOps.contain(image, size, method=Image.Resampling.LANCZOS)
    x = (size[0] - fitted.width) // 2
    y = (size[1] - fitted.height) // 2
    canvas.paste(fitted, (x, y))
    return canvas


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def paste_rounded(canvas, image, xy, size, radius=28, shadow=True, cover_mode=False):
    x, y = xy
    if shadow:
        shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow_layer)
        shadow_draw.rounded_rectangle(
            (x + 12, y + 16, x + size[0] + 12, y + size[1] + 16),
            radius=radius,
            fill=(38, 32, 28, 48),
        )
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(16))
        canvas.alpha_composite(shadow_layer)

    prepared = cover(image, size) if cover_mode else contain(image, size, (255, 255, 255))
    prepared = prepared.convert("RGBA")
    mask = rounded_mask(size, radius)
    canvas.paste(prepared, xy, mask)
    border = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(
        (x, y, x + size[0] - 1, y + size[1] - 1),
        radius=radius,
        outline=(214, 205, 194, 180),
        width=2,
    )
    canvas.alpha_composite(border)


def draw_gradient(size, stops):
    width, height = size
    image = Image.new("RGB", size, stops[0])
    pixels = image.load()
    for y in range(height):
        t = y / max(1, height - 1)
        if t < 0.55:
            tt = t / 0.55
            a, b = stops[0], stops[1]
        else:
            tt = (t - 0.55) / 0.45
            a, b = stops[1], stops[2]
        row = tuple(int(a[i] + (b[i] - a[i]) * tt) for i in range(3))
        for x in range(width):
            pixels[x, y] = row
    return image.convert("RGBA")


def font(size, bold=True):
    path = FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(str(path), size)


def draw_label(canvas, title, subtitle=None, xy=(56, 52), color=(38, 32, 28), light=False):
    draw = ImageDraw.Draw(canvas)
    title_color = (255, 255, 255) if light else color
    sub_color = (255, 255, 255, 210) if light else (96, 87, 78)
    draw.text(xy, title, fill=title_color, font=font(46, True))
    if subtitle:
        draw.text((xy[0], xy[1] + 64), subtitle, fill=sub_color, font=font(22, False))


def product_paths(products, ids):
    paths = []
    for item_id in ids:
        product = products.get(item_id)
        if not product:
            continue
        path = product_image(product)
        if path:
            paths.append(path)
    return paths


def draw_logo(canvas, xy, width):
    if not LOGO_PATH.exists():
        return
    logo = Image.open(LOGO_PATH).convert("RGBA")
    ratio = width / logo.width
    logo = logo.resize((width, int(logo.height * ratio)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, xy)


def save_jpg(image, name, quality=88):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / name
    image.convert("RGB").save(path, quality=quality, optimize=True, progressive=True)
    print(path.relative_to(ROOT).as_posix())


def make_hero(products):
    charge_ids = rechargeable_product_ids(products)
    canvas = draw_gradient((1600, 920), [(230, 235, 232), (249, 246, 240), (87, 112, 120)])
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, 0, 720, 920), fill=(36, 42, 43, 96))
    draw.ellipse((920, -260, 1940, 780), fill=(255, 255, 255, 82))
    draw.ellipse((580, 520, 1540, 1180), fill=(192, 86, 61, 42))
    draw.line((760, 110, 1480, 760), fill=(255, 255, 255, 88), width=8)
    draw.line((860, 92, 1500, 620), fill=(195, 86, 61, 66), width=5)
    canvas.alpha_composite(overlay)

    ids = pick(
        products,
        ["s02-c01", "wh-k39-a01", "k35-a01", "k04-a01", "ksd-a01"],
        charge_ids,
        5,
    )
    images = [open_image(p) for p in product_paths(products, ids)]
    placements = [
        ((875, 110), (500, 500), 34, False),
        ((1140, 390), (365, 365), 30, False),
        ((1015, 590), (330, 250), 26, False),
        ((1235, 88), (285, 285), 26, False),
        ((770, 440), (305, 305), 26, False),
    ]
    for img, (xy, size, radius, cover_mode) in zip(images, placements):
        paste_rounded(canvas, img, xy, size, radius, cover_mode=cover_mode)
    draw_logo(canvas, (72, 70), 330)
    save_jpg(canvas, "hero-risukai-lineup.jpg", 88)


def make_side(products, name, ids, title, subtitle, colors):
    canvas = draw_gradient((900, 640), colors)
    ImageDraw.Draw(canvas).ellipse((470, -140, 1040, 390), fill=(255, 255, 255, 62))
    paths = product_paths(products, ids)
    positions = [((430, 70), (330, 330)), ((600, 315), (240, 240)), ((350, 260), (210, 210))]
    for path, (xy, size) in zip(paths, positions):
        paste_rounded(canvas, open_image(path), xy, size, 24)
    save_jpg(canvas, name, 88)


def make_category(products, name, ids, title, colors):
    canvas = draw_gradient((640, 420), colors)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((30, 30, 610, 390), radius=32, outline=(255, 255, 255, 88), width=2)
    paths = product_paths(products, ids)
    positions = [((310, 96), (230, 230)), ((100, 142), (190, 190)), ((422, 220), (150, 150))]
    for path, (xy, size) in zip(paths, positions):
        paste_rounded(canvas, open_image(path), xy, size, 20)
    save_jpg(canvas, name, 86)


def make_news(products, name, ids, colors):
    canvas = draw_gradient((384, 288), colors)
    paths = product_paths(products, ids)
    positions = [((140, 34), (170, 170)), ((42, 92), (132, 132))]
    for path, (xy, size) in zip(paths, positions):
        paste_rounded(canvas, open_image(path), xy, size, 16)
    save_jpg(canvas, name, 86)


def make_library(products):
    canvas = draw_gradient((1200, 900), [(242, 246, 243), (224, 231, 225), (78, 101, 106)])
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((550, -160, 1360, 650), fill=(255, 255, 255, 82))
    draw.rounded_rectangle((58, 58, 1142, 842), radius=42, outline=(255, 255, 255, 118), width=2)
    ids = pick(
        products,
        ["s02-c01", "wh-k39-a01", "k35-a01", "k04-a01", "ksd-a01", "syj-090-a01"],
        rechargeable_product_ids(products),
        6,
    )
    placements = [
        ((115, 180), (340, 340)),
        ((430, 110), (270, 270)),
        ((715, 178), (275, 275)),
        ((260, 540), (225, 225)),
        ((540, 515), (235, 235)),
        ((790, 520), (250, 250)),
    ]
    for path, (xy, size) in zip(product_paths(products, ids), placements):
        paste_rounded(canvas, open_image(path), xy, size, 26)
    draw_logo(canvas, (82, 74), 270)
    save_jpg(canvas, "library-risukai-products.jpg", 88)


def main():
    products = load_products()
    charge_ids = rechargeable_product_ids(products)
    make_hero(products)
    make_side(
        products,
        "nav-all-products.jpg",
        pick(products, ["s02-c01", "k35-a01", "wh-k39-a01"], charge_ids, 3),
        "ALL PRODUCTS",
        "CHARGE LINEUP",
        [(52, 70, 77), (107, 128, 111), (38, 45, 44)],
    )
    make_side(
        products,
        "nav-shop-by-need.jpg",
        pick(products, ["k04-a01", "wh-k47-a01", "ksd-a01"], charge_ids, 3),
        "SHOP BY NEED",
        "CAR / WIRELESS / DAILY",
        [(157, 72, 56), (201, 158, 96), (74, 64, 55)],
    )

    categories = [
        ("cat-smartphone-case.jpg", pick(products, CHARGE_GROUPS["fast"], charge_ids, 3), "急速充電器", [(66, 87, 102), (190, 211, 214), (55, 68, 75)]),
        ("cat-film.jpg", pick(products, CHARGE_GROUPS["cable"], charge_ids, 3), "充電ケーブル", [(76, 90, 92), (205, 218, 210), (59, 72, 71)]),
        ("cat-wallet-case.jpg", pick(products, CHARGE_GROUPS["wireless"], charge_ids, 3), "ワイヤレス充電", [(92, 86, 105), (210, 202, 222), (56, 54, 70)]),
        ("cat-back-cover.jpg", pick(products, CHARGE_GROUPS["car"], charge_ids, 3), "車載充電", [(80, 76, 65), (212, 196, 162), (58, 56, 50)]),
        ("cat-shoulder-strap.jpg", pick(products, CHARGE_GROUPS["daily"], charge_ids, 3), "充電式日用品", [(102, 82, 78), (222, 198, 184), (74, 58, 55)]),
        ("cat-accessory.jpg", pick(products, CHARGE_GROUPS["emergency"], charge_ids, 3), "防災・旅行", [(63, 81, 82), (188, 205, 190), (54, 65, 65)]),
        ("cat-custom-set.jpg", pick(products, ["s02-c01", "wh-k39-a01", "k04-a01"], charge_ids, 3), "充電セット", [(80, 99, 105), (182, 202, 195), (49, 59, 61)]),
        ("cat-business-bulk.jpg", pick(products, ["k35-a01", "s15-a01", "fd-2026-e01"], charge_ids, 3), "まとめ買い", [(78, 76, 65), (208, 194, 154), (59, 58, 50)]),
    ]
    for args in categories:
        make_category(products, *args)

    make_news(products, "news-new-items.jpg", pick(products, ["wh-k47-a01", "s15-a01"], charge_ids, 2), [(66, 82, 82), (178, 195, 181), (55, 65, 62)])
    make_news(products, "news-model-update.jpg", pick(products, ["k35-a01", "k47-a01"], charge_ids, 2), [(80, 76, 95), (205, 198, 218), (62, 58, 74)])
    make_news(products, "news-care-guide.jpg", pick(products, ["ksd-a01", "syj-090-a01"], charge_ids, 2), [(122, 78, 70), (226, 192, 178), (76, 58, 54)])
    make_library(products)


if __name__ == "__main__":
    main()
