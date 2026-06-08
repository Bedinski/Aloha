#!/usr/bin/env python3
"""Generate PWA icons for the Aloha dashboard (pure stdlib, no Pillow).

Draws a simple tropical scene: an ocean gradient with a sun and foam waves.
Outputs full-bleed icons (also valid as maskable) plus a favicon.
"""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(round(lerp(c1[i], c2[i], t))) for i in range(3))


def smoothstep(edge0, edge1, x):
    if edge0 == edge1:
        return 0.0 if x < edge0 else 1.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def render(n):
    """Return an RGBA bytearray for an n x n icon."""
    sky_top = (0x7d, 0xd3, 0xfc)      # light sky blue
    sea_top = (0x22, 0xd3, 0xee)      # cyan
    sea_bot = (0x0c, 0x4a, 0x6e)      # deep ocean
    sun_in = (0xff, 0xf3, 0xb0)       # pale yellow
    sun_out = (0xfb, 0x92, 0x3c)      # orange
    foam = (0xe0, 0xf7, 0xff)

    cx, cy = 0.34 * n, 0.36 * n       # sun center
    sun_r = 0.165 * n
    horizon = 0.40                    # sky/sea split (fraction of height)

    buf = bytearray(n * n * 4)
    for y in range(n):
        fy = y / n
        for x in range(n):
            fx = x / n

            # --- background: sky fading into a sea gradient ---
            if fy < horizon:
                t = fy / horizon
                r, g, b = mix(sky_top, sea_top, t)
            else:
                t = (fy - horizon) / (1 - horizon)
                r, g, b = mix(sea_top, sea_bot, t)

            # --- sun (with soft glow) ---
            d = math.hypot(x - cx, y - cy)
            glow = smoothstep(sun_r * 2.4, sun_r * 1.0, d) * 0.35
            r, g, b = mix((r, g, b), sun_out, glow)
            disc = smoothstep(sun_r, sun_r - 2.0, d)
            if disc > 0:
                sr = d / sun_r
                sun_col = mix(sun_in, sun_out, max(0.0, min(1.0, sr)))
                r, g, b = mix((r, g, b), sun_col, disc)

            # --- foam waves over the sea ---
            if fy > horizon:
                for base, amp, freq, thick in (
                    (0.60, 0.022, 3.0, 0.018),
                    (0.74, 0.028, 2.2, 0.020),
                    (0.88, 0.020, 3.6, 0.016),
                ):
                    wy = base + amp * math.sin(fx * freq * 2 * math.pi)
                    a = smoothstep(thick, thick * 0.3, abs(fy - wy))
                    if a > 0:
                        r, g, b = mix((r, g, b), foam, a * 0.85)

            i = (y * n + x) * 4
            buf[i] = r
            buf[i + 1] = g
            buf[i + 2] = b
            buf[i + 3] = 255
    return buf


def write_png(path, n, rgba):
    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))

    ihdr = struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0)  # RGBA, 8-bit
    raw = bytearray()
    stride = n * 4
    for y in range(n):
        raw.append(0)  # filter: none
        raw.extend(rgba[y * stride:(y + 1) * stride])
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in (192, 512):
        png = os.path.join(OUT, f"icon-{size}.png")
        write_png(png, size, render(size))
        print("wrote", png)
    # small favicon
    write_png(os.path.join(OUT, "favicon-64.png"), 64, render(64))
    print("wrote favicon-64.png")


if __name__ == "__main__":
    main()
