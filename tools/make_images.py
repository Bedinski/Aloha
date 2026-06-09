#!/usr/bin/env python3
"""Generate Hawaiian scenery for the Aloha app (pure stdlib, no Pillow).

Produces a Waikiki-style sunset hero: gradient dusk sky, a low sun with glow
and an ocean reflection, the Diamond Head crater on the horizon, and palm-tree
silhouettes in the foreground. Output is a PNG so the result can be eyeballed
and tuned.
"""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "images")


# ---------- small color helpers ----------
def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    t = max(0.0, min(1.0, t))
    return tuple(lerp(c1[i], c2[i], t) for i in range(3))


def smoothstep(e0, e1, x):
    if e0 == e1:
        return 0.0 if x < e0 else 1.0
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def grad(stops, pos):
    """Piecewise gradient. stops = sorted list of (pos, (r,g,b))."""
    if pos <= stops[0][0]:
        return stops[0][1]
    if pos >= stops[-1][0]:
        return stops[-1][1]
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        if p0 <= pos <= p1:
            return mix(c0, c1, (pos - p0) / (p1 - p0))
    return stops[-1][1]


# ---------- PNG writer ----------
def write_png(path, w, h, rgba):
    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))

    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw.extend(rgba[y * stride:(y + 1) * stride])
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        f.write(chunk(b"IEND", b""))


def make_hero(W=1200, H=540):
    buf = bytearray(W * H * 4)

    HY = 0.60 * H                      # horizon line
    sun_x, sun_y = 0.40 * W, 0.50 * H  # setting sun
    sun_r = 0.115 * W

    sky = [
        (0.00, (34, 38, 92)),    # deep indigo
        (0.40, (108, 70, 134)),  # violet
        (0.66, (214, 84, 96)),   # coral
        (0.84, (250, 140, 84)),  # orange
        (1.00, (255, 216, 142)), # gold horizon
    ]
    ocean = [
        (0.00, (120, 196, 188)),
        (0.22, (30, 150, 165)),
        (0.60, (16, 96, 120)),
        (1.00, (8, 60, 80)),
    ]
    GOLD = (255, 212, 132)
    clouds = [  # (cx, cy, rx, ry, color, alpha) as fractions of W/H
        (0.62, 0.20, 0.26, 0.030, (255, 196, 170), 0.55),
        (0.30, 0.30, 0.30, 0.028, (255, 170, 150), 0.45),
        (0.78, 0.40, 0.22, 0.022, (255, 158, 120), 0.40),
        (0.15, 0.46, 0.20, 0.020, (255, 180, 150), 0.35),
    ]

    for y in range(H):
        for x in range(W):
            if y < HY:
                r, g, b = grad(sky, y / HY)
                # soft sun glow lightens the sky around the sun
                d = math.hypot(x - sun_x, y - sun_y)
                glow = smoothstep(sun_r * 3.4, sun_r * 0.9, d)
                r, g, b = mix((r, g, b), (255, 226, 168), glow * 0.6)
                # clouds
                for cx, cy, rx, ry, col, a in clouds:
                    cxp, cyp, rxp, ryp = cx * W, cy * H, rx * W, ry * H
                    e = ((x - cxp) / rxp) ** 2 + ((y - cyp) / ryp) ** 2
                    cl = smoothstep(1.0, 0.2, e)
                    if cl > 0:
                        r, g, b = mix((r, g, b), col, cl * a)
                # the sun disc itself
                disc = smoothstep(sun_r, sun_r - 3, d)
                if disc > 0:
                    sun_col = mix((255, 250, 226), (255, 198, 120), d / sun_r)
                    r, g, b = mix((r, g, b), sun_col, disc)
            else:
                t = (y - HY) / (H - HY)
                r, g, b = grad(ocean, t)
                # golden reflection beneath the sun, with horizontal shimmer
                horiz = max(0.0, 1 - abs(x - sun_x) / (0.16 * W + t * 0.12 * W))
                shimmer = 0.55 + 0.45 * math.sin(y * 0.5 + math.sin(x * 0.02))
                refl = horiz * (1 - t * 0.7) * shimmer
                r, g, b = mix((r, g, b), GOLD, max(0.0, min(0.8, refl)))

            i = (y * W + x) * 4
            buf[i], buf[i + 1], buf[i + 2], buf[i + 3] = (
                int(r), int(g), int(b), 255)

    _draw_diamond_head(buf, W, H, HY)
    _draw_palm(buf, W, H, bx=0.135 * W, crown=(0.175 * W, 0.20 * H),
               L=0.225 * W, flip=False)
    _draw_palm(buf, W, H, bx=0.945 * W, crown=(0.895 * W, 0.31 * H),
               L=0.150 * W, flip=True)
    return buf, W, H


def _set(buf, W, H, x, y, color, a=1.0):
    x, y = int(x), int(y)
    if 0 <= x < W and 0 <= y < H:
        i = (y * W + x) * 4
        if a >= 1:
            buf[i], buf[i + 1], buf[i + 2] = color
        else:
            buf[i] = int(buf[i] * (1 - a) + color[0] * a)
            buf[i + 1] = int(buf[i + 1] * (1 - a) + color[1] * a)
            buf[i + 2] = int(buf[i + 2] * (1 - a) + color[2] * a)


def _disk(buf, W, H, cx, cy, r, color):
    if r < 0.5:
        _set(buf, W, H, cx, cy, color)
        return
    for yy in range(int(cy - r), int(cy + r) + 1):
        for xx in range(int(cx - r), int(cx + r) + 1):
            if (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r:
                _set(buf, W, H, xx, yy, color)


def _draw_diamond_head(buf, W, H, HY):
    col = (40, 34, 62)            # dusky silhouette
    x0 = int(0.60 * W)
    peak = 0.20 * H
    for x in range(x0, W):
        u = (x - x0) / (W - x0)   # 0..1 across the headland
        # Diamond Head profile: a broad crater rising to a left peak.
        shape = (0.95 * math.exp(-((u - 0.28) / 0.16) ** 2)
                 + 0.45 * math.exp(-((u - 0.62) / 0.30) ** 2))
        top = HY - peak * min(1.0, shape)
        for y in range(int(top), int(HY) + 1):
            edge = smoothstep(top - 1.5, top + 1.5, y)
            _set(buf, W, H, x, y, col, edge)


def _draw_palm(buf, W, H, bx, crown, L, flip):
    trunk = (24, 18, 28)
    frond = (18, 14, 22)
    cx_top, cy_top = crown
    base_y = H + 8

    # curved, tapering trunk
    steps = int((base_y - cy_top))
    for s_i in range(steps + 1):
        s = s_i / steps
        y = cy_top + s * (base_y - cy_top)
        x = cx_top + (bx - cx_top) * s + math.sin(s * math.pi) * (-0.03 * W if not flip else 0.03 * W)
        w = lerp(4.5, 15.0, s)
        for dx in range(int(-w / 2), int(w / 2) + 1):
            _set(buf, W, H, x + dx, y, trunk)

    # crown of drooping fronds
    angles = [168, 150, 122, 92, 60, 30, 8, -16, 200]
    droop = 0.55
    for a_deg in angles:
        a = math.radians(180 - a_deg if flip else a_deg)
        dirx, diry = math.cos(a), math.sin(a)  # diry>0 means upward (we negate y)
        n = int(L * 2.2)
        for k in range(n + 1):
            t = k / n
            sx = cx_top + dirx * t * L
            sy = cy_top - diry * t * L + droop * (t ** 2) * L
            hw = 7.0 * math.sin(math.pi * (min(1.0, t) ** 0.7))
            _disk(buf, W, H, sx, sy, hw, frond)
    _disk(buf, W, H, cx_top, cy_top, 7, frond)  # coconuts cluster


def main():
    os.makedirs(OUT, exist_ok=True)
    buf, W, H = make_hero()
    path = os.path.join(OUT, "hero.png")
    write_png(path, W, H, buf)
    print("wrote", path, f"({W}x{H})")


if __name__ == "__main__":
    main()
