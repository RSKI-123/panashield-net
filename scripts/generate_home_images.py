import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_JSON = ROOT / "assets" / "data" / "products.json"
OUTPUT_DIR = ROOT / "assets" / "images" / "home"
LOGO_PATH = ROOT / "assets" / "images" / "risukai-logo-rectangle.png"
FONT_BOLD = Path("C:/Windows/Fonts/NotoSansJP-VF.ttf")
FONT_REGULAR = Path("C:/Windows/Fonts/NotoSansJP-VF.ttf")


def load_products():
    products = json.loads(PRODUCTS_JSON.read_text(encoding="utf-8"))["products"]
    return {item["managementNumber"]: item for item in products}


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
    canvas = draw_gradient((1600, 920), [(232, 222, 209), (248, 244, 238), (116, 131, 112)])
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, 0, 760, 920), fill=(39, 34, 30, 96))
    draw.ellipse((980, -220, 1900, 760), fill=(255, 255, 255, 76))
    draw.ellipse((620, 520, 1560, 1180), fill=(192, 86, 61, 42))
    canvas.alpha_composite(overlay)

    ids = ["m22-a01", "t776-a01", "s02-c01", "mtkc-a01", "p001-01-01"]
    images = [open_image(p) for p in product_paths(products, ids)]
    placements = [
        ((900, 120), (490, 490), 34, False),
        ((1135, 360), (360, 360), 30, False),
        ((1040, 580), (320, 250), 26, False),
        ((1240, 95), (280, 280), 26, False),
        ((790, 450), (300, 300), 26, False),
    ]
    for img, (xy, size, radius, cover_mode) in zip(images, placements):
        paste_rounded(canvas, img, xy, size, radius, cover_mode=cover_mode)
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
    canvas = draw_gradient((1200, 900), [(245, 240, 234), (226, 215, 202), (83, 98, 85)])
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((550, -160, 1360, 650), fill=(255, 255, 255, 82))
    draw.rounded_rectangle((58, 58, 1142, 842), radius=42, outline=(255, 255, 255, 118), width=2)
    ids = ["m22-a01", "t776-a01", "s02-c01", "pen-715k-a01", "mimi-a01", "t825-a01"]
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
    make_hero(products)
    make_side(
        products,
        "nav-all-products.jpg",
        ["m22-a01", "t776-a01", "s02-c01", "mtkc-a01"],
        "ALL PRODUCTS",
        "RISUKAI LINEUP",
        [(52, 63, 70), (102, 120, 92), (37, 41, 38)],
    )
    make_side(
        products,
        "nav-shop-by-need.jpg",
        ["t776-a01", "wh-k35-a01", "pen-715k-a01"],
        "SHOP BY NEED",
        "CASE / CHARGE / ACCESSORY",
        [(157, 72, 56), (203, 155, 82), (76, 56, 44)],
    )

    categories = [
        ("cat-smartphone-case.jpg", ["p001-01-01", "t118-a01", "v002-a01"], "スマホケース", [(75, 84, 91), (210, 198, 184), (104, 91, 82)]),
        ("cat-film.jpg", ["mtkc-a01", "t823-a01", "t732-a01"], "保護フィルム", [(66, 87, 102), (192, 211, 214), (62, 72, 78)]),
        ("cat-wallet-case.jpg", ["v005-a01", "b003-01-01", "p001-02-01"], "手帳型ケース", [(112, 75, 59), (214, 185, 166), (73, 54, 48)]),
        ("cat-back-cover.jpg", ["p002-01-01", "t117-a01", "t356-a01"], "背面カバー", [(48, 77, 72), (195, 216, 205), (59, 75, 65)]),
        ("cat-shoulder-strap.jpg", ["t776-a01", "t776-b01", "v005-a01"], "ショルダー", [(127, 84, 92), (221, 185, 194), (72, 54, 61)]),
        ("cat-accessory.jpg", ["mimi-a01", "pen-715k-a01", "wh-k35-a01"], "アクセサリー", [(64, 63, 84), (202, 194, 219), (50, 48, 60)]),
        ("cat-custom-set.jpg", ["s02-c01", "wh-k39-a01", "m22-a01"], "充電・セット", [(80, 99, 105), (182, 202, 195), (49, 59, 61)]),
        ("cat-business-bulk.jpg", ["syj-090-a01", "tbk-a01", "3db10-a01"], "まとめ買い", [(78, 76, 65), (208, 194, 154), (59, 58, 50)]),
    ]
    for args in categories:
        make_category(products, *args)

    make_news(products, "news-new-items.jpg", ["zj-k007-a01", "wh-k47-a01"], [(66, 82, 82), (178, 195, 181), (55, 65, 62)])
    make_news(products, "news-model-update.jpg", ["t823-a01", "t732-a01"], [(80, 76, 95), (205, 198, 218), (62, 58, 74)])
    make_news(products, "news-care-guide.jpg", ["mimi-b01", "3db10-a01"], [(122, 78, 70), (226, 192, 178), (76, 58, 54)])
    make_library(products)


if __name__ == "__main__":
    main()
