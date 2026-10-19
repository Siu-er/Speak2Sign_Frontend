"""Paint Vy's cyan signature into a VRoid export of one of her looks.

  python scripts/paint-vy.py <VRoid export .vrm> <out .vrm> scripts/vy-looks/<look>.json

Requires numpy, scipy and Pillow. The look file maps the export's material
indices to the roles below and holds the texel positions each role draws at,
measured on that export's texture layout; a re-export with a changed outfit
needs its positions measured again.

Black and white stay the base. The signature is cyan that grades within every
piece, from deep cerulean to ice: a vertical piece brightens towards its top,
a band that wraps around the body brightens towards its middle and darkens to
both ends. A quarter of each colour follows height on the body, so pieces near
the shoulders sit icier and pieces near the boots deeper. Thin lines are drawn
as light: a core that whitens towards its centre and a halo of its own colour.

The pieces: piping on every trim edge, double cuff stripes, the skirt band with
a pin line, stocking welts, seams and emblems, glove bands, boot sole lines, the
hoodie's facings and panels, the ear glow, the headphone ring, Vy's mark (a V
whose tips read as cat ears) on the skirt flap and the ear cups, and a black tie
carrying a glitched V, a lead of light and a diamond cut by an X.
"""
import io, json, struct, sys
import numpy as np
import scipy.ndimage as nd
from PIL import Image, ImageDraw, ImageFilter

# Position along a piece (0 deep, 1 ice) -> colour.
RAMP = [
    (0.00, (0, 88, 168)),
    (0.30, (0, 140, 212)),
    (0.60, (16, 204, 240)),
    (0.82, (110, 240, 255)),
    (1.00, (220, 255, 255)),
]
OWN_WEIGHT = 0.75  # share of a colour set by its position within the piece; the rest follows body height
BODY_HEIGHT_M = 1.62
SS = 4  # supersampling factor for drawn shapes
WHITE = (255, 255, 255)

def ramp(s):
    ss = [p for p, _ in RAMP]
    cs = np.array([c for _, c in RAMP], float) / 255
    return np.stack([np.interp(s, ss, cs[:, k]) for k in range(3)], -1)

def height_map(tris, w, h):
    """Height of the surface under every texel from the UV triangles, and which texels a triangle covers."""
    out = np.full((h, w), np.nan)
    for t in tris:
        # Textures repeat, so a triangle beyond the unit tile maps back into it.
        u = np.array(t[0::4])
        v = np.array(t[1::4])
        u = (u - np.floor(u.min())) * w
        v = (v - np.floor(v.min())) * h
        y = np.array(t[3::4])
        x0, x1 = int(np.floor(u.min())), int(np.ceil(u.max())) + 1
        y0, y1 = int(np.floor(v.min())), int(np.ceil(v.max())) + 1
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w), min(y1, h)
        if x0 >= x1 or y0 >= y1:
            continue
        px, py = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
        det = (v[1] - v[2]) * (u[0] - u[2]) + (u[2] - u[1]) * (v[0] - v[2])
        if abs(det) < 1e-12:
            continue
        l0 = ((v[1] - v[2]) * (px - u[2]) + (u[2] - u[1]) * (py - v[2])) / det
        l1 = ((v[2] - v[0]) * (px - u[2]) + (u[0] - u[2]) * (py - v[2])) / det
        l2 = 1 - l0 - l1
        inside = (l0 >= -1e-3) & (l1 >= -1e-3) & (l2 >= -1e-3)
        region = out[y0:y1, x0:x1]
        region[inside] = (l0 * y[0] + l1 * y[1] + l2 * y[2])[inside]
    covered = ~np.isnan(out)
    if not covered.any():
        raise ValueError("no UV triangles cover the texture")
    _, (iy, ix) = nd.distance_transform_edt(~covered, return_indices=True)
    return out[iy, ix], covered

def sweep(mask, hn, wrap=None):
    """Colour each connected piece of mask by its position along its own long axis.

    A piece in wrap (a boolean mask) or lying across the texture is a band around
    the body and peaks in its middle; a piece lying up the texture brightens upward.
    """
    col = np.zeros(mask.shape + (3,))
    lab, _ = nd.label(mask, structure=np.ones((3, 3)))
    for i, sl in enumerate(nd.find_objects(lab)):
        m = lab[sl] == i + 1
        ys, xs = np.nonzero(m)
        pts = np.stack([xs, ys], 1).astype(float)
        pts -= pts.mean(0)
        if len(pts) < 3:
            t = np.full(len(xs), 0.5)
        else:
            _, vec = np.linalg.eigh(pts.T @ pts)
            ax = vec[:, 1]
            p = pts @ ax
            p = (p - p.min()) / max(p.max() - p.min(), 1e-6)
            band = (wrap is not None and wrap[sl][m].any()) or abs(ax[0]) >= abs(ax[1])
            if band:
                t = 1 - np.abs(2 * p - 1)
            else:
                t = 1 - p if ax[1] > 0 else p
        s = OWN_WEIGHT * t + (1 - OWN_WEIGHT) * hn[sl][m]
        region = col[sl]
        region[m] = ramp(s)
    return col

def hsv(a):
    v = a[..., :3].max(-1)
    s = (v - a[..., :3].min(-1)) / np.maximum(v, 1e-6)
    return s, v

def light_trims(a, min_v=0.42):
    s, v = hsv(a)
    return (s < 0.2) & (v > min_v) & (a[..., 3] > 0.5)

def light(out, mask, lit):
    """Turn a painted line into light: its centre whitens and a halo of its own colour spreads around it."""
    out = out.copy()
    core = (np.clip(nd.distance_transform_edt(mask) / lit["core"], 0, 1) ** 2 * lit["whiten"])[..., None]
    out[..., :3] = np.where(mask[..., None], out[..., :3] + (1 - out[..., :3]) * core, out[..., :3])
    m = mask.astype(float)
    spread = nd.gaussian_filter(m, lit["glow"])
    colour = np.stack([nd.gaussian_filter(out[..., c] * m, lit["glow"]) for c in range(3)], -1) / np.maximum(spread, 1e-6)[..., None]
    halo = (np.clip(spread * 2 * lit["strength"], 0, lit["strength"]) * ~mask)[..., None]
    out[..., :3] = out[..., :3] * (1 - halo) + colour * halo
    return out

def paint(a, mask, hn, wrap=None, lit=None):
    """Swept colour over mask, keeping a little of the trim's own shading so bevels still read; with lit, as light."""
    _, v = hsv(a)
    shade = np.clip(0.82 + 0.18 * v / 0.9, 0.82, 1.0)[..., None]
    out = a.copy()
    out[..., :3] = np.where(mask[..., None], sweep(mask, hn, wrap) * shade, a[..., :3])
    return light(out, mask, lit) if lit else out

def components(mask, keep):
    lab, _ = nd.label(mask)
    out = np.zeros_like(mask)
    for i, sl in enumerate(nd.find_objects(lab)):
        box = (sl[1].start, sl[0].start, sl[1].stop, sl[0].stop)
        if keep(box):
            out[sl] |= lab[sl] == i + 1
    return out

def overlay(a, draw_fn, hn=None, wrap_all=False, rgb=None, blur=0, strength=1.0, lit=None):
    """Composite antialiased shapes drawn by draw_fn(ImageDraw, scale).

    Shapes keep their drawn colour, or take the colour map rgb, or with hn the swept colour;
    blur (in texels) and strength turn the shapes into a soft glow; with lit they become light.
    """
    h, w = a.shape[:2]
    layer = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer), SS)
    if blur:
        layer = layer.filter(ImageFilter.GaussianBlur(blur * SS))
    layer = np.asarray(layer.resize((w, h), Image.LANCZOS), float) / 255
    al = layer[..., 3:4] * strength
    if rgb is None and hn is None:
        rgb = layer[..., :3]
    elif rgb is None:
        shape = al[..., 0] > 0.02
        rgb = sweep(shape, hn, shape if wrap_all else None)
    out = a.copy()
    out[..., :3] = a[..., :3] * (1 - al) + rgb * al
    return light(out, al[..., 0] > 0.5, lit) if lit else out

def mark(d, cx, cy, size, scale, fill=WHITE):
    """Vy's mark: a V whose two arms end in pointed cat-ear tips, with a diamond between them."""
    s = size * scale
    x, y = cx * scale, cy * scale
    w = 0.22
    p = lambda u, v: (x + u * s, y + v * s)
    d.polygon([p(-0.5, -0.5), p(-0.5 + w * 1.15, -0.32), p(0, 0.5 - 1.9 * w), p(0.5 - w * 1.15, -0.32),
               p(0.5, -0.5), p(0, 0.5)], fill=fill)
    g = 0.11
    d.polygon([p(0, -0.36 - g), p(g, -0.36), p(0, -0.36 + g), p(-g, -0.36)], fill=fill)

def fill_hole(a, box, pad=6):
    """Clear an existing print by filling its box with the median of the cloth around it."""
    x0, y0, x1, y1 = box
    ring = np.concatenate([a[y0 - pad:y0, x0:x1].reshape(-1, 4), a[y1:y1 + pad, x0:x1].reshape(-1, 4),
                           a[y0:y1, x0 - pad:x0].reshape(-1, 4), a[y0:y1, x1:x1 + pad].reshape(-1, 4)])
    out = a.copy()
    out[y0:y1, x0:x1, :3] = np.median(ring[:, :3], 0)
    return out

def jacket(a, hn, lay):
    """Every light trim becomes piping; the cuff lines wrap the wrist, and each gets a second stripe inside it."""
    cuffs = np.zeros(a.shape[:2], bool)
    for x0, x1 in lay["cuff_lines_x"]:
        cuffs[:, x0:x1] = True
    # Down to the trims' bevel shading, so a trim recolours whole rather than leaving a grey rim.
    a = paint(a, light_trims(a, lay["jacket_trim_min_v"]), hn, cuffs, lay["light"])
    def inner(d, k):
        for x0 in lay["cuff_inner_x"]:
            d.rectangle([x0 * k, 0, (x0 + 8) * k, lay["cuff_length"] * k], fill=WHITE)
    return overlay(a, inner, hn, wrap_all=True, lit=lay["light"])

def collar(a, hn, lay):
    return paint(a, light_trims(a, lay["jacket_trim_min_v"]), hn, lit=lay["light"])

def shirt_skirt(a, hn, lay):
    """Trims on the belt, chain and flap hem; Vy's mark replaces the flap's print."""
    ex0, ey0, ex1, ey1 = emblem = lay["skirt_emblem"]
    shirt_w = lay["shirt_max_x"]
    trims = components(light_trims(a), lambda b: (b[2] - b[0]) * (b[3] - b[1]) < 400000 and b[0] < shirt_w
                       and not (b[0] >= ex0 and b[2] <= ex1 and b[1] >= ey0))
    a = fill_hole(a, emblem)
    a = paint(a, trims, hn, lit=lay["light"])
    cx, cy = (ex0 + ex1) / 2, lay["skirt_mark_y"]
    return overlay(a, lambda d, k: mark(d, cx, cy, 50, k), hn)

def skirt(a, hn, lay):
    """The cloth goes from grey to the jacket's black; the hem band goes solid, with a pin line following it above."""
    band = light_trims(a)
    s, v = hsv(a)
    a = a.copy()
    a[..., :3] = np.where(((s < 0.2) & ~band)[..., None], a[..., :3] * lay["skirt_darken"], a[..., :3])
    a = paint(a, band, hn, band)
    has = band.any(0)
    top = np.where(has, band.argmax(0), -1)
    def pin_line(d, k):
        for x in np.where(has)[0]:
            d.rectangle([x * k, (top[x] - 13) * k, (x + 1) * k, (top[x] - 9) * k], fill=WHITE)
    return overlay(a, pin_line, hn, wrap_all=True, lit=lay["light"])

def boots(a, hn, lay):
    y = lay["sole_top"]
    return overlay(a, lambda d, k: d.rectangle([0, y * k, a.shape[1] * k, (y + 7) * k], fill=WHITE), hn, wrap_all=True, lit=lay["light"])

def body(a, hn, lay):
    """Stocking welts level around each leg, and a band around the base of each glove."""
    s, v = hsv(a)
    y0, y1 = lay["stocking_search"]
    # Charcoal stocking cloth goes to black; skin is excluded by its brightness.
    darken = np.zeros(v.shape, bool)
    for x0, x1 in lay["stocking_columns"]:
        darken[y0:, x0:x1] = True
    a = a.copy()
    a[..., :3] = np.where((darken & (s < 0.15) & (v < 0.45))[..., None], a[..., :3] * lay["stocking_darken"], a[..., :3])
    def welts(d, k):
        for x0, x1 in lay["stocking_columns"]:
            tops = []
            for x in range(x0, x1):
                run = np.convolve(v[y0:y1, x] < lay["stocking_dark"], np.ones(40), "valid") == 40
                if run.any():
                    tops.append(y0 + int(np.argmax(run)))
            if not tops:
                raise ValueError(f"no stocking edge found in columns {x0}-{x1}")
            y = int(np.median(tops)) + 10
            d.rectangle([x0 * k, y * k, x1 * k, (y + 8) * k], fill=WHITE)
            d.rectangle([x0 * k, (y + 13) * k, x1 * k, (y + 16) * k], fill=WHITE)
    a = overlay(a, welts, hn, wrap_all=True, lit=lay["light"])
    # Clipped to the glove's own black so the band cannot reach skin.
    gy = lay["glove_band_y"]
    band = np.zeros(v.shape, bool)
    for x0, x1 in lay["glove_columns"]:
        band[gy:gy + 9, x0:x1] = True
    band &= v < 0.2
    a = paint(a, band, hn, band, lay["light"])
    # Stocking seams run the length of the leg; each line is widened by a texel so it reads.
    seams = np.zeros(v.shape, bool)
    sy0, sy1 = lay.get("seam_rows", (0, 0))
    for x0, x1 in lay.get("seams_x", []):
        seams[sy0:sy1, x0:x1] = v[sy0:sy1, x0:x1] < 0.15
    seams = nd.binary_dilation(seams, structure=np.ones((1, 3)))
    a = paint(a, seams, hn, lit=lay["light"])
    s, v = hsv(a)
    emblem = np.zeros(v.shape, bool)
    for x0, y0, x1, y1 in lay.get("stocking_emblems", []):
        emblem[y0:y1, x0:x1] = (s[y0:y1, x0:x1] < 0.2) & (v[y0:y1, x0:x1] > 0.45)
    # The inner shape of an emblem goes black, so it reads apart from the cyan frame around it.
    hollow = Image.new("L", (v.shape[1], v.shape[0]), 0)
    for poly in lay.get("stocking_emblem_hollows", []):
        ImageDraw.Draw(hollow).polygon([tuple(q) for q in poly], fill=255)
    hollow = (np.asarray(hollow) > 0) & emblem
    a = paint(a, emblem & ~hollow, hn)
    a[..., :3] = np.where(hollow[..., None], lay["black"], a[..., :3])
    return a

def hoodie(a, hn, lay):
    """Grey side panels become black diamonds outlined in cyan; the grey front facings, hem stripes
    and shirt marks take the swept cyan; the black pin lines above cuffs and hem become cyan."""
    p = lay["hoodie"]
    s, v = hsv(a)
    grey = (v > 0.55) & (v < 0.86) & (s < 0.12)
    def within(boxes, m):
        out = np.zeros(m.shape, bool)
        for x0, y0, x1, y1 in boxes:
            out[y0:y1, x0:x1] = m[y0:y1, x0:x1]
        return out
    panels = within(p["panels"], grey)
    a = a.copy()
    a[..., :3] = np.where(panels[..., None], lay["black"], a[..., :3])
    outline = panels & ~nd.binary_erosion(panels, iterations=p["outline"])
    a = paint(a, outline, hn)
    a = paint(a, within(p["facings"], grey), hn)
    a = paint(a, within(p["hem_stripes"], grey), hn)
    a = paint(a, within(p["shirt_marks"], s > 0.3), hn)
    pins = within(p["pin_lines"], v < 0.3)
    return paint(a, pins, hn, pins, lay["light"])

def glow(a, hn, lay):
    s, v = hsv(a)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    blue = ((s > 0.35) & (v > 0.45)) * np.clip((b - np.maximum(r, g)) / 0.2, 0, 1)
    gold = ((s > 0.3) & (v > 0.25) & (g > b)) * np.clip((r - b - 0.1) / 0.15, 0, 1)
    w = np.maximum(blue, gold)
    col = sweep(w > 0.1, hn)
    out = a.copy()
    out[..., :3] = a[..., :3] * (1 - w[..., None]) + np.clip(col * (v / 0.95)[..., None], 0, 1) * w[..., None]
    return out

def ring(a, hn, lay, covered):
    _, v = hsv(a)
    out = a.copy()
    out[..., :3] = np.clip(sweep(covered, hn, covered) * (v / np.percentile(v[covered], 90))[..., None], 0, 1)
    return out

class Field:
    """The drawable stretch of the tie blade: v runs 0 to 1 down it, u runs -1 to 1 across its width."""

    def __init__(self, centre, half, y0, y1, xx, yy):
        self.centre, self.half, self.y0, self.y1, self.xx, self.yy = centre, half, y0, y1, xx, yy

    def y(self, v):
        return self.y0 + v * (self.y1 - self.y0)

    def x(self, u, v):
        row = int(self.y(v))
        return self.centre[row] + u * self.half[row]

    def at(self, u, v, k):
        return (self.x(u, v) * k, self.y(v) * k)

    def down(self):
        return np.clip((self.yy - self.y0) / (self.y1 - self.y0), 0, 1)

def clip_rows(poly, y0, y1):
    """The part of a convex polygon between rows y0 and y1."""
    for limit, keep in ((y0, lambda y: y >= y0), (y1, lambda y: y <= y1)):
        out = []
        for (xa, ya), (xb, yb) in zip(poly, poly[1:] + poly[:1]):
            if keep(ya):
                out.append((xa, ya))
            if keep(ya) != keep(yb):
                t = (limit - ya) / (yb - ya)
                out.append((xa + t * (xb - xa), limit))
        poly = out
    return poly

def beam(out, xx, yy, a, b, width, level, glow, strength):
    """A line of light from a to b: a core that whitens towards its centre line, a cyan glow
    around it, and a width that may taper to points. width and level are functions of the
    position t (0 at a, 1 at b); level is the ramp position of the core's edge."""
    (ax, ay), (bx, by) = a, b
    widest = max(width(t) for t in np.linspace(0, 1, 64))
    pad = widest + 3 * glow
    x0, x1 = int(max(min(ax, bx) - pad, 0)), int(min(max(ax, bx) + pad, xx.shape[1]))
    y0, y1 = int(max(min(ay, by) - pad, 0)), int(min(max(ay, by) + pad, xx.shape[0]))
    X, Y = xx[y0:y1, x0:x1], yy[y0:y1, x0:x1]
    dx, dy = bx - ax, by - ay
    t = np.clip(((X - ax) * dx + (Y - ay) * dy) / (dx * dx + dy * dy), 0, 1)
    d = np.hypot(X - (ax + t * dx), Y - (ay + t * dy))
    half = width(t) / 2
    core = np.clip(half - d + 0.5, 0, 1)[..., None]
    halo = (strength * np.exp(-(d / (half + glow)) ** 2) * np.sqrt(np.clip(2 * half / widest, 0, 1)))[..., None]
    whiten = np.clip(1 - d / np.maximum(half, 1e-3), 0, 1) ** 2
    region = out[y0:y1, x0:x1, :3]
    region[:] = region * (1 - halo) + ramp(np.clip(level(t) - 0.2, 0, 1)) * halo
    region[:] = region * (1 - core) + ramp(np.clip(level(t) + 0.45 * whiten, 0, 1)) * core
    return out

def flare(width):
    """Width profile of a streak that is widest at its middle and tapers to points at both ends."""
    return lambda t: width * (1 - np.abs(2 * t - 1)) ** 0.6

def tie_glitch(out, f, p):
    """Vy's V in cyan, sliced and displaced as if the signal glitched, a flare across the blade
    under it, and a lead of light running from it down the centre line.

    A chevron is apex v, arm depth in v, half width in u, thickness in v, and the slices
    (v0, v1, shift in u) it is drawn in. A flare at v reaches u across both sides. The lead
    runs v0..v1 tapering from width w0 to w1 texels.
    """
    g = p["glitch"]
    def chevrons(d, k):
        for apex, depth, share, thick, slices in g["chevrons"]:
            arms = [[f.at(-share, apex - depth, k), f.at(0, apex, k), f.at(0, apex - thick, k), f.at(-share, apex - depth - thick, k)],
                    [f.at(0, apex, k), f.at(share, apex - depth, k), f.at(share, apex - depth - thick, k), f.at(0, apex - thick, k)]]
            for v0, v1, shift in slices:
                dx = shift * f.half[int(f.y(apex))] * k
                for arm in arms:
                    part = clip_rows(arm, f.y(v0) * k, f.y(v1) * k)
                    if len(part) >= 3:
                        d.polygon([(x + dx, y) for x, y in part], fill=WHITE)
    colour = ramp(np.clip(0.25 + 0.75 * (1 - f.down()) ** 0.8, 0, 1))
    out = overlay(out, chevrons, rgb=colour, blur=p["glow"], strength=0.3)
    out = overlay(out, chevrons, rgb=colour)
    for v, reach in g["flares"]:
        out = beam(out, f.xx, f.yy, f.at(-reach, v, 1), f.at(reach, v, 1), flare(p["flare_width"]),
                   lambda t: 0.75 + 0.2 * (1 - np.abs(2 * t - 1)), p["glow"], 0.55)
    v0, v1, w0, w1 = g["lead"]
    fade_in = lambda t: np.clip(t / 0.12, 0, 1) ** 2 * (3 - 2 * np.clip(t / 0.12, 0, 1))
    return beam(out, f.xx, f.yy, f.at(0, v0, 1), f.at(0, v1, 1), lambda t: (w0 + (w1 - w0) * t) * fade_in(t),
                lambda t: 0.85 - 0.35 * t, p["glow"], 0.5)

def tie_gem(out, xx, yy, cx, ty, r, p):
    """A flat cyan diamond at the tip, cut by an X into four pieces, with a flare passing behind it.

    The X runs from the centre to the middle of each edge, so each piece holds one point of
    the diamond; the pieces stand apart by the cut width, moved out towards their points.
    """
    out = beam(out, xx, yy, (cx - 2.9 * r, ty), (cx + 2.9 * r, ty), flare(p["flare_width"]),
               lambda t: 0.7 + 0.25 * (1 - np.abs(2 * t - 1)), p["glow"], 0.55)
    points = [np.array(q) for q in ((cx, ty - 1.3 * r), (cx + r, ty), (cx, ty + 1.3 * r), (cx - r, ty))]
    centre = np.array((cx, ty))
    pieces = []
    for i, point in enumerate(points):
        before, after = points[i - 1], points[(i + 1) % 4]
        away = (point - centre) / np.linalg.norm(point - centre) * p["gem_cut"] / 2
        pieces.append([q + away for q in (point, (point + after) / 2, centre, (point + before) / 2)])
    def gem(d, k):
        for piece in pieces:
            d.polygon([(x * k, y * k) for x, y in piece], fill=WHITE)
    colour = ramp(np.clip(0.95 - 0.55 * (yy - (ty - 1.3 * r)) / (2.6 * r), 0, 1))
    out = overlay(out, gem, rgb=colour, blur=p["glow"], strength=0.4)
    return overlay(out, gem, rgb=colour)

def tie(a, hn, lay, covered):
    """A black tie under a cyan knot, carrying a glitched V, a lead of light and a cut diamond at the tip."""
    _, v = hsv(a)
    fold = np.clip(v / np.percentile(v[covered], 95), 0.55, 1.0)[..., None]
    lab, _ = nd.label(covered)
    sizes = nd.sum(covered, lab, range(1, lab.max() + 1))
    order = np.argsort(sizes)[::-1] + 1
    blade, knot = lab == order[0], lab == order[1]
    neckband = covered & ~blade & ~knot
    p = lay["tie"]
    h, w = v.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    ys, xs = np.nonzero(blade)
    top, tip = ys.min(), ys.max()
    rows = np.arange(h)
    left = np.array([xs[ys == y].min() if (ys == y).any() else 0 for y in rows], float)
    right = np.array([xs[ys == y].max() if (ys == y).any() else 0 for y in rows], float)
    centre, half = (left + right) / 2, (right - left) / 2
    cx = centre[tip - int(0.05 * (tip - top))]
    length = tip - top

    out = a.copy()
    out[..., :3] = np.where(blade[..., None], lay["black"] * fold, a[..., :3])
    out[..., :3] = np.where(knot[..., None], sweep(knot, hn, knot) * fold, out[..., :3])
    out[..., :3] = np.where(neckband[..., None], lay["black"] * fold, out[..., :3])
    y0, y1 = top + p["field_start"] * length, tip - p["tip_depth"] - p["field_gap"]
    # A border of light round the blade parts the black tie from the black jacket and skirt it
    # crosses; it brightens towards the tip, where the tie lies on the skirt.
    border = blade & ~nd.binary_erosion(blade, iterations=p["border"])
    along = np.clip((yy - top) / length, 0, 1)
    out[..., :3] = np.where(border[..., None], ramp(0.35 + 0.6 * along), out[..., :3])
    out = light(out, border, p["border_light"])
    out = tie_glitch(out, Field(centre, half, y0, y1, xx, yy), p)
    return tie_gem(out, xx, yy, cx, tip - p["tip_depth"] * 0.55, p["gem_size"], p)

def cup_plate(a, hn, lay):
    cx, cy, r = lay["plate"]
    def disc(d, k):
        d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=(18, 18, 22))
        d.ellipse([(cx - r * 0.8) * k, (cy - r * 0.8) * k, (cx + r * 0.8) * k, (cy + r * 0.8) * k], outline=(235, 238, 242), width=int(r * 0.025 * k))
    def accents(d, k):
        d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], outline=WHITE, width=int(r * 0.09 * k))
        mark(d, cx, cy + r * 0.05, r * 0.95, k)
    return overlay(overlay(a, disc), accents, hn)

def cup_shell(a, hn, lay):
    """The grey cup shell goes to the jacket's black."""
    out = a.copy()
    out[..., :3] = a[..., :3] * lay["cup_darken"]
    return out

ROLES = {f.__name__: f for f in (jacket, hoodie, collar, shirt_skirt, skirt, boots, body, tie, glow, cup_shell, ring, cup_plate)}
NEEDS_COVERAGE = {ring, tie}

COMPONENT = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

def accessor(gltf, bin_, index):
    acc = gltf["accessors"][index]
    view = gltf["bufferViews"][acc["bufferView"]]
    dtype = np.dtype(COMPONENT[acc["componentType"]])
    n = WIDTH[acc["type"]]
    stride = view.get("byteStride", n * dtype.itemsize)
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    rows = np.frombuffer(bin_, np.uint8, (acc["count"] - 1) * stride + n * dtype.itemsize, start)
    return np.lib.stride_tricks.as_strided(rows, (acc["count"], n * dtype.itemsize), (stride, 1)).copy().view(dtype)

def uv_triangles(gltf, bin_):
    """Per material, each triangle as u, v, x, height for its three corners."""
    out = {}
    for mesh in gltf["meshes"]:
        for prim in mesh["primitives"]:
            uv = accessor(gltf, bin_, prim["attributes"]["TEXCOORD_0"])
            pos = accessor(gltf, bin_, prim["attributes"]["POSITION"])
            idx = accessor(gltf, bin_, prim["indices"]).reshape(-1, 3)
            corners = np.concatenate([uv, pos[:, :2]], 1)[idx].reshape(len(idx), 12)
            out.setdefault(prim["material"], []).extend(corners.tolist())
    return out

def main(src, dst, layout):
    lay = json.load(open(layout))
    data = open(src, "rb").read()
    jlen = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + jlen])
    bin_ = data[20 + jlen + 8:]
    tris = uv_triangles(gltf, bin_)
    views = gltf["bufferViews"]
    blobs = [bin_[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]] for v in views]
    done = set()
    for key, role in lay["materials"].items():
        i, fn = int(key), ROLES[role]
        pbr = gltf["materials"][i]["pbrMetallicRoughness"]
        t = pbr["baseColorTexture"]["index"]
        img = gltf["images"][gltf["textures"][t]["source"]]
        if img["bufferView"] in done:
            raise ValueError(f"material {i} shares an image already painted")
        done.add(img["bufferView"])
        im = Image.open(io.BytesIO(blobs[img["bufferView"]])).convert("RGBA")
        scale = lay.get("upscale", {}).get(key, 1)
        im = im.resize((im.width * scale, im.height * scale), Image.LANCZOS)
        a = np.asarray(im, float) / 255
        # The material's tint is baked into the texture, so painted colour renders exactly as drawn.
        a[..., :3] *= np.array(pbr.get("baseColorFactor", [1, 1, 1, 1])[:3])
        pbr["baseColorFactor"] = [1, 1, 1, 1]
        heights, covered = height_map(tris[i], a.shape[1], a.shape[0])
        hn = np.clip(heights / BODY_HEIGHT_M, 0, 1)
        painted = fn(a, hn, lay, covered) if fn in NEEDS_COVERAGE else fn(a, hn, lay)
        out = io.BytesIO()
        Image.fromarray((painted.clip(0, 1) * 255).round().astype(np.uint8)).save(out, "PNG")
        img["mimeType"] = "image/png"
        blobs[img["bufferView"]] = out.getvalue()
        print("painted material", i)
    packed = bytearray()
    for v, b in zip(views, blobs):
        packed += b"\0" * (-len(packed) % 4)
        v["byteOffset"], v["byteLength"] = len(packed), len(b)
        packed += b
    packed += b"\0" * (-len(packed) % 4)
    gltf["buffers"][0]["byteLength"] = len(packed)
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    body_ = struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(packed), 0x004E4942) + packed
    open(dst, "wb").write(struct.pack("<III", 0x46546C67, 2, 12 + len(body_)) + body_)

if __name__ == "__main__":
    main(*sys.argv[1:])
