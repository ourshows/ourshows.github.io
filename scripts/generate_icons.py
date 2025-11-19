import os
from pathlib import Path

try:
  from PIL import Image, ImageDraw
except ImportError as exc:  # pragma: no cover
  raise SystemExit("Pillow is required to generate icons. Install via `pip install pillow`.") from exc


ACCENT_GRADIENT = ("#0f172a", "#141b2f", "#1d1f3b", "#ef4444")
GLOW_COLOR = (239, 68, 68, 120)
PLAY_COLOR = "#f8fafc"
FILM_STRIP = "#f97316"


def _gradient_image(size):
  img = Image.new("RGB", (size, size), "#0f172a")
  draw = ImageDraw.Draw(img)
  for y in range(size):
    t = y / (size - 1)
    if t < 0.33:
      color = ACCENT_GRADIENT[0]
    elif t < 0.66:
      color = ACCENT_GRADIENT[1]
    elif t < 0.9:
      color = ACCENT_GRADIENT[2]
    else:
      color = ACCENT_GRADIENT[3]
    draw.line([(0, y), (size, y)], fill=color)
  return img


def _add_glow(draw, size):
  margin = int(size * 0.12)
  draw.ellipse(
    (margin, margin, size - margin, size - margin),
    fill=GLOW_COLOR,
  )


def _add_badge(draw, size):
  badge_width = int(size * 0.64)
  badge_height = int(size * 0.42)
  x0 = (size - badge_width) // 2
  y0 = (size - badge_height) // 2
  radius = badge_height // 2
  draw.rounded_rectangle(
    (x0, y0, x0 + badge_width, y0 + badge_height),
    radius=radius,
    fill=PLAY_COLOR,
  )
  tri_padding = int(badge_height * 0.2)
  tri_x0 = x0 + tri_padding
  tri_y0 = y0 + tri_padding
  tri_y1 = y0 + badge_height - tri_padding
  tri_x2 = x0 + badge_width - tri_padding
  draw.polygon(
    [(tri_x0, tri_y0), (tri_x2, (tri_y0 + tri_y1) // 2), (tri_x0, tri_y1)],
    fill=ACCENT_GRADIENT[-1],
  )


def _add_clapboard(draw, size):
  board_width = int(size * 0.7)
  board_height = int(size * 0.18)
  x0 = (size - board_width) // 2
  y0 = int(size * 0.22)
  draw.rounded_rectangle(
    (x0, y0, x0 + board_width, y0 + board_height),
    radius=board_height // 4,
    fill=FILM_STRIP,
  )
  stripe_width = board_width / 6
  for i in range(6):
    if i % 2 == 0:
      x_start = x0 + i * stripe_width
      draw.rectangle(
        (x_start, y0, x_start + stripe_width * 0.7, y0 + board_height),
        fill=PLAY_COLOR,
      )


def create_icon(size, dest):
  base = _gradient_image(size).convert("RGBA")
  glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
  glow_draw = ImageDraw.Draw(glow)
  _add_glow(glow_draw, size)
  base = Image.alpha_composite(base, glow)
  draw = ImageDraw.Draw(base)
  _add_clapboard(draw, size)
  _add_badge(draw, size)
  base.save(dest, format="PNG")


def main():
  root = Path(__file__).resolve().parents[1]
  icons_dir = root / "icons"
  icons_dir.mkdir(exist_ok=True)
  for size in (192, 512):
    create_icon(size, icons_dir / f"icon-{size}x{size}.png")
  print(f"Generated icons in {icons_dir}")


if __name__ == "__main__":
  main()

