"""Paint the signature into a VRoid export of a signer's look.

  python scripts/paint-signer.py assets/vy/uniform-export.vrm public/avatars/vy.vrm scripts/signer-looks/uniform.json
  python scripts/paint-signer.py assets/vy/hoodie-export.vrm public/avatars/vy-hoodie.vrm scripts/signer-looks/hoodie.json
  python scripts/paint-signer.py assets/viet/viet-export.vrm public/avatars/viet.vrm scripts/signer-looks/viet.json

The exports come from the VRoid Studio projects beside them in assets/vy and assets/viet.
Requires numpy, scipy and Pillow. The look file maps the export's material indices to the
roles below, holds the texel positions each role draws at (measured on that
export's texture layout, so a re-export with a changed outfit needs them measured
again), and names the colour family of every line group and accent.

Black and white stay the base. The signature is drawn as light in the three colours
of the app icon, blue, red and amber, each grading within its piece from deep to
bright: thin lines have a core that whitens towards its centre and a halo of their
own colour. Vy's pieces: piping, cuff and pin lines, the skirt band, stocking welts,
glove bands and boot soles, shared out between the three colours; the hoodie's
facings and panels; the ear glow and headphone ring; a black tie carrying a
glitched V, a lead of light and a diamond cut by an X; decals drawn in body
coordinates (the back emblem, the skirt sigil and Vy's mark on the stockings).
Viet's: a black tactical parka whose printed accents take the three colours, a navy
collar lining with a lit rim, lines round the cuffs and hem, a chest mark, a light down
each side of the zip and a back sigil with circuit traces; cargo shorts over knee-high
knit socks with a lit outer stripe; high-tops with lit soles. Both have gradient hair
with highlights that tint its own shading.
"""
import io, json, struct, sys
import numpy as np
import scipy.ndimage as nd
from PIL import Image, ImageDraw, ImageFilter

# The signature's colour families, from the app icon: position along a piece (0 deep, 1 lightest) -> colour.
RAMPS = {
    "blue": [(0.00, (0, 88, 168)), (0.30, (0, 140, 212)), (0.60, (16, 204, 240)), (0.82, (110, 240, 255)), (1.00, (220, 255, 255))],
    "red": [(0.00, (110, 8, 28)), (0.30, (186, 32, 46)), (0.60, (224, 77, 76)), (0.82, (255, 140, 124)), (1.00, (255, 218, 205))],
    "amber": [(0.00, (140, 58, 10)), (0.30, (205, 104, 36)), (0.60, (229, 142, 72)), (0.82, (246, 182, 96)), (1.00, (255, 236, 186))],
}
OWN_WEIGHT = 0.75  # share of a colour set by its position within the piece; the rest follows body height
BODY_HEIGHT_M = 1.62
SS = 4  # supersampling factor for drawn shapes
FABRIC_FLOOR = 0.03  # value offset in fabric shading, about the darkest shadow a black cloth texture carries
WHITE = (255, 255, 255)

def ramp(s, family="blue"):
    stops = RAMPS[family]
    ss = [p for p, _ in stops]
    cs = np.array([c for _, c in stops], float) / 255
    return np.stack([np.interp(s, ss, cs[:, k]) for k in range(3)], -1)

def surface_maps(uv, pos, w, h):
    """Position and unit normal of the surface under every texel, from the triangles' UVs and
    corner positions, and which texels a triangle covers; texels outside take the nearest value."""
    pmap = np.full((h, w, 3), np.nan)
    nmap = np.zeros((h, w, 3))
    face_n = np.cross(pos[:, 1] - pos[:, 0], pos[:, 2] - pos[:, 0])
    face_n /= np.maximum(np.linalg.norm(face_n, axis=1, keepdims=True), 1e-12)
    for tuv, tp, n in zip(uv, pos, face_n):
        # Textures repeat, so a triangle beyond the unit tile maps back into it.
        u = (tuv[:, 0] - np.floor(tuv[:, 0].min())) * w
        v = (tuv[:, 1] - np.floor(tuv[:, 1].min())) * h
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
        bary = np.stack([l0, l1, l2], -1)[inside]
        pmap[y0:y1, x0:x1][inside] = bary @ tp
        nmap[y0:y1, x0:x1][inside] = n
    covered = ~np.isnan(pmap[..., 0])
    if not covered.any():
        raise ValueError("no UV triangles cover the texture")
    _, (iy, ix) = nd.distance_transform_edt(~covered, return_indices=True)
    return pmap[iy, ix], nmap[iy, ix], covered

DECAL_MM = 1.0  # millimetres per pixel of a decal drawing in body space

def decals(a, pmap, nmap, covered, specs, lit):
    """Designs drawn in body coordinates and projected onto the garment, lit like the other lines.

    A spec names a view (front, back, left, right), the colour family, the ramp levels it runs
    between from its lowest to its highest point, and shapes in metres in that view: x across
    (the model's own left is +x seen from the front), y up from the floor. A texel takes the
    design only where its surface faces the view, so a design never shows through to the far side.
    """
    view = {"front": (0, 1), "back": (0, -1), "left": (2, 1), "right": (2, -1)}
    out = a
    for spec in specs:
        axis_sign = view[spec["view"]]
        facing = nmap[..., 2] * axis_sign[1] if axis_sign[0] == 0 else nmap[..., 0] * axis_sign[1]
        depth_axis = 2 if axis_sign[0] == 0 else 0
        across_axis = 0 if axis_sign[0] == 0 else 2
        ys = [p[1] for s in spec["shapes"] for p in s["points"]]
        xs = [p[0] for s in spec["shapes"] for p in s["points"]]
        pad = 0.05
        ox, oy = min(xs) - pad, min(ys) - pad
        W = int((max(xs) - ox + pad) * 1000 / DECAL_MM) + 1
        H = int((max(ys) - oy + pad) * 1000 / DECAL_MM) + 1
        canvas = Image.new("L", (W * SS, H * SS), 0)
        d = ImageDraw.Draw(canvas)
        k = 1000 / DECAL_MM * SS
        to_px = lambda p: ((p[0] - ox) * k, (H / (1000 / DECAL_MM) - (p[1] - oy)) * k)
        for s in spec["shapes"]:
            pts = [to_px(p) for p in s["points"]]
            if s["kind"] == "line":
                d.line(pts, fill=255, width=max(1, int(s["width"] / DECAL_MM * SS)), joint="curve")
            else:
                d.polygon(pts, fill=255)
        canvas = np.asarray(canvas.resize((W, H), Image.LANCZOS), float) / 255
        cx = ((pmap[..., across_axis] - ox) * 1000 / DECAL_MM).astype(int)
        cy = ((H / (1000 / DECAL_MM) - (pmap[..., 1] - oy)) * 1000 / DECAL_MM).astype(int)
        valid = covered & (facing > spec.get("facing", 0.35)) & (cx >= 0) & (cx < W) & (cy >= 0) & (cy < H)
        weight = np.zeros(a.shape[:2])
        weight[valid] = canvas[cy[valid], cx[valid]]
        if spec.get("depth"):
            lo, hi = spec["depth"]
            weight *= (pmap[..., depth_axis] >= lo) & (pmap[..., depth_axis] <= hi)
        level = np.clip((pmap[..., 1] - min(ys)) / max(max(ys) - min(ys), 1e-6), 0, 1)
        lo_l, hi_l = spec["levels"]
        colour = ramp(lo_l + (hi_l - lo_l) * level, spec["family"])
        out = out.copy()
        w3 = weight[..., None]
        out[..., :3] = out[..., :3] * (1 - w3) + colour * w3
        out = light(out, weight > 0.5, lit)
    return out

def sweep(mask, hn, wrap=None, family="blue"):
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
        region[m] = ramp(s, family)
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

def paint(a, mask, hn, wrap=None, lit=None, family="blue"):
    """Swept colour over mask, keeping a little of the trim's own shading so bevels still read; with lit, as light."""
    _, v = hsv(a)
    shade = np.clip(0.82 + 0.18 * v / 0.9, 0.82, 1.0)[..., None]
    out = a.copy()
    out[..., :3] = np.where(mask[..., None], sweep(mask, hn, wrap, family) * shade, a[..., :3])
    return light(out, mask, lit) if lit else out

def components(mask, keep):
    lab, _ = nd.label(mask)
    out = np.zeros_like(mask)
    for i, sl in enumerate(nd.find_objects(lab)):
        box = (sl[1].start, sl[0].start, sl[1].stop, sl[0].stop)
        if keep(box):
            out[sl] |= lab[sl] == i + 1
    return out

def overlay(a, draw_fn, hn=None, wrap_all=False, rgb=None, blur=0, strength=1.0, lit=None, family="blue"):
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
        rgb = sweep(shape, hn, shape if wrap_all else None, family)
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
    a = paint(a, light_trims(a, lay["jacket_trim_min_v"]), hn, cuffs, lay["light"], lay["lines"]["piping"])
    def inner(d, k):
        for x0 in lay["cuff_inner_x"]:
            d.rectangle([x0 * k, 0, (x0 + 8) * k, lay["cuff_length"] * k], fill=WHITE)
    return overlay(a, inner, hn, wrap_all=True, lit=lay["light"], family=lay["lines"]["cuff_inner"])

def collar(a, hn, lay):
    return paint(a, light_trims(a, lay["jacket_trim_min_v"]), hn, lit=lay["light"], family=lay["lines"]["collar"])

def shirt_skirt(a, hn, lay):
    """Trims on the belt, chain and flap hem; Vy's mark replaces the flap's print."""
    ex0, ey0, ex1, ey1 = emblem = lay["skirt_emblem"]
    shirt_w = lay["shirt_max_x"]
    trims = components(light_trims(a), lambda b: (b[2] - b[0]) * (b[3] - b[1]) < 400000 and b[0] < shirt_w
                       and not (b[0] >= ex0 and b[2] <= ex1 and b[1] >= ey0))
    a = fill_hole(a, emblem)
    a = paint(a, trims, hn, lit=lay["light"], family=lay["lines"]["belt"])
    if not lay.get("skirt_mark", True):
        return a
    cx, cy = (ex0 + ex1) / 2, lay["skirt_mark_y"]
    return overlay(a, lambda d, k: mark(d, cx, cy, 50, k), hn, family=lay["accents"]["mark"])

def skirt(a, hn, lay):
    """The cloth goes from grey to the jacket's black; the hem band goes solid, with a pin line following it above."""
    band = light_trims(a)
    s, v = hsv(a)
    a = a.copy()
    a[..., :3] = np.where(((s < 0.2) & ~band)[..., None], a[..., :3] * lay["skirt_darken"], a[..., :3])
    pleats = lay.get("pleat_lines")
    if pleats:
        # The pleats' creases are narrow dark streaks in the cloth; a grey edge drawn beside each
        # keeps the folds readable once the cloth is darkened to black.
        cloth = (s < 0.2) & ~band & (a[..., 3] > 0.5)
        detail = v - nd.gaussian_filter(v, (1, 6))
        crease = cloth & (detail < -pleats["threshold"])
        edge = nd.binary_dilation(crease, structure=np.ones((1, 2 * pleats["width"] + 1))) & ~crease & cloth
        # The edges stop short of the hem band and its pin line, where creases break into flecks.
        band_top = np.where(band.any(0), band.argmax(0), a.shape[0])
        edge &= np.arange(a.shape[0])[:, None] < band_top[None, :] - pleats["hem_clearance"]
        a[..., :3] = np.where(edge[..., None], pleats["grey"], a[..., :3])
    a = paint(a, band, hn, band, family=lay["lines"]["hem"])
    has = band.any(0)
    top = np.where(has, band.argmax(0), -1)
    def pin_line(d, k):
        for x in np.where(has)[0]:
            d.rectangle([x * k, (top[x] - 13) * k, (x + 1) * k, (top[x] - 9) * k], fill=WHITE)
    return overlay(a, pin_line, hn, wrap_all=True, lit=lay["light"], family=lay["lines"]["pin_line"])

def boots(a, hn, lay):
    y = lay["sole_top"]
    return overlay(a, lambda d, k: d.rectangle([0, y * k, a.shape[1] * k, (y + 7) * k], fill=WHITE), hn, wrap_all=True, lit=lay["light"], family=lay["lines"]["sole"])

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
    def welts():
        for x0, x1 in lay["stocking_columns"]:
            tops = []
            for x in range(x0, x1):
                run = np.convolve(v[y0:y1, x] < lay["stocking_dark"], np.ones(40), "valid") == 40
                if run.any():
                    tops.append(y0 + int(np.argmax(run)))
            if not tops:
                raise ValueError(f"no stocking edge found in columns {x0}-{x1}")
            yield x0, x1, int(np.median(tops)) + 10
    def band_line(d, k):
        for x0, x1, y in edges:
            d.rectangle([x0 * k, y * k, x1 * k, (y + 8) * k], fill=WHITE)
    def fine_line(d, k):
        for x0, x1, y in edges:
            d.rectangle([x0 * k, (y + 13) * k, x1 * k, (y + 16) * k], fill=WHITE)
    edges = list(welts())
    a = overlay(a, band_line, hn, wrap_all=True, lit=lay["light"], family=lay["lines"]["welt"])
    a = overlay(a, fine_line, hn, wrap_all=True, lit=lay["light"], family=lay["lines"]["welt_fine"])
    # Clipped to the glove's own black so the band cannot reach skin.
    gy = lay["glove_band_y"]
    band = np.zeros(v.shape, bool)
    for x0, x1 in lay["glove_columns"]:
        band[gy:gy + 9, x0:x1] = True
    band &= v < 0.2
    a = paint(a, band, hn, band, lay["light"], lay["lines"]["glove"])
    # Stocking seams run the length of the leg; each line is widened by a texel so it reads.
    seams = np.zeros(v.shape, bool)
    sy0, sy1 = lay.get("seam_rows", (0, 0))
    for x0, x1 in lay.get("seams_x", []):
        seams[sy0:sy1, x0:x1] = v[sy0:sy1, x0:x1] < 0.15
    seams = nd.binary_dilation(seams, structure=np.ones((1, 3)))
    a = paint(a, seams, hn, lit=lay["light"], family=lay["lines"]["seam"])
    s, v = hsv(a)
    emblem = np.zeros(v.shape, bool)
    for x0, y0, x1, y1 in lay.get("stocking_emblems", []):
        emblem[y0:y1, x0:x1] = (s[y0:y1, x0:x1] < 0.2) & (v[y0:y1, x0:x1] > 0.45)
    # The inner shape of an emblem goes black, so it reads apart from the cyan frame around it.
    hollow = Image.new("L", (v.shape[1], v.shape[0]), 0)
    for poly in lay.get("stocking_emblem_hollows", []):
        ImageDraw.Draw(hollow).polygon([tuple(q) for q in poly], fill=255)
    hollow = (np.asarray(hollow) > 0) & emblem
    a = paint(a, emblem & ~hollow, hn, family=lay["lines"]["stocking_emblem"])
    a[..., :3] = np.where(hollow[..., None], lay["black"], a[..., :3])
    return a

def hoodie(a, hn, lay):
    """Grey side panels become black diamonds with a lit outline; the grey front facings, hem
    stripes and shirt marks take a swept colour; the black pin lines above cuffs and hem become light.
    Each group's colour family comes from lay["lines"]."""
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
    lines = lay["lines"]
    a = paint(a, outline, hn, family=lines["panel_outline"])
    a = paint(a, within(p["facings"], grey), hn, family=lines["facing"])
    a = paint(a, within(p["hem_stripes"], grey), hn, family=lines["hem_stripe"])
    a = paint(a, within(p["shirt_marks"], s > 0.3), hn, family=lines["shirt_mark"])
    pins = within(p["pin_lines"], v < 0.3)
    return paint(a, pins, hn, pins, lay["light"], lines["pin"])

def glow(a, hn, lay):
    s, v = hsv(a)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    blue = ((s > 0.35) & (v > 0.45)) * np.clip((b - np.maximum(r, g)) / 0.2, 0, 1)
    gold = ((s > 0.3) & (v > 0.25) & (g > b)) * np.clip((r - b - 0.1) / 0.15, 0, 1)
    w = np.maximum(blue, gold)
    col = sweep(w > 0.1, hn, family=lay["accents"]["ears"])
    out = a.copy()
    out[..., :3] = a[..., :3] * (1 - w[..., None]) + np.clip(col * (v / 0.95)[..., None], 0, 1) * w[..., None]
    return out

def ring(a, hn, lay, covered):
    _, v = hsv(a)
    out = a.copy()
    out[..., :3] = np.clip(sweep(covered, hn, covered, lay["accents"]["ring"]) * (v / np.percentile(v[covered], 90))[..., None], 0, 1)
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

def beam(out, xx, yy, a, b, width, level, glow, strength, family="blue"):
    """A line of light from a to b: a core that whitens towards its centre line, a glow
    around it, and a width that may taper to points. width and level are functions of the
    position t (0 at a, 1 at b); level is the ramp position of the core's edge in the colour family."""
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
    region[:] = region * (1 - halo) + ramp(np.clip(level(t) - 0.2, 0, 1), family) * halo
    region[:] = region * (1 - core) + ramp(np.clip(level(t) + 0.45 * whiten, 0, 1), family) * core
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

def tie_gem(out, xx, yy, cx, ty, r, p, family):
    """A flat diamond at the tip, cut by an X into four pieces, with a flare passing behind it.

    The X runs from the centre to the middle of each edge, so each piece holds one point of
    the diamond; the pieces stand apart by the cut width, moved out towards their points.
    """
    out = beam(out, xx, yy, (cx - 2.9 * r, ty), (cx + 2.9 * r, ty), flare(p["flare_width"]),
               lambda t: 0.7 + 0.25 * (1 - np.abs(2 * t - 1)), p["glow"], 0.55, family)
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
    colour = ramp(np.clip(0.95 - 0.55 * (yy - (ty - 1.3 * r)) / (2.6 * r), 0, 1), family)
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
    return tie_gem(out, xx, yy, cx, tip - p["tip_depth"] * 0.55, p["gem_size"], p, lay["accents"]["gem"])

def cup_plate(a, hn, lay):
    cx, cy, r = lay["plate"]
    def disc(d, k):
        d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=(18, 18, 22))
        d.ellipse([(cx - r * 0.8) * k, (cy - r * 0.8) * k, (cx + r * 0.8) * k, (cy + r * 0.8) * k], outline=(235, 238, 242), width=int(r * 0.025 * k))
    def accents(d, k):
        d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], outline=WHITE, width=int(r * 0.09 * k))
        mark(d, cx, cy + r * 0.05, r * 0.95, k)
    return overlay(overlay(a, disc), accents, hn, family=lay["accents"]["mark"])

def cup_shell(a, hn, lay):
    """The grey cup shell goes to the jacket's black."""
    out = a.copy()
    out[..., :3] = a[..., :3] * lay["cup_darken"]
    return out

def strand_colour(stops, v):
    """Colour along a strand from (position, rgb) stops, position 0 at the root and 1 at the tip."""
    ps = [q for q, _ in stops]
    cs = np.array([c for _, c in stops], float) / 255
    return np.stack([np.interp(v, ps, cs[:, k]) for k in range(3)], -1)

FIBRE_PITCH = 7  # texels between fibre clumps across the strip; finer pitches read as stringy rather than as hair

def fibres(width, height, seed):
    """Strand texture for one shared hair strip: per column a fibre brightness in 0..1, drifting
    gently down the strand so the fibres do not run ruler-straight."""
    rng = np.random.default_rng(seed)
    pad = 2 * FIBRE_PITCH
    knots = rng.random((width + pad) // FIBRE_PITCH + 3)
    base = np.interp(np.arange(width + pad) / FIBRE_PITCH, np.arange(len(knots)), knots)
    fine = nd.gaussian_filter1d(rng.random(width + pad), 1.5)
    line = nd.gaussian_filter1d(0.8 * base + 0.2 * (fine - fine.min()) / np.ptp(fine), 1.0)
    line = (line - line.min()) / np.ptp(line)
    v = np.arange(height)[:, None]
    drift = 3.0 * np.sin(v / height * 5.1) + 1.5 * np.sin(v / height * 13.7 + 0.8)
    cols = np.clip(np.arange(width)[None, :] + FIBRE_PITCH + drift, 0, width + pad - 1)
    return np.interp(cols, np.arange(width + pad), line)

def streaks(out, h, rows, cols):
    """Coloured highlights woven into the hair: every strand shares the strip, so a column band
    becomes a highlight along every strand. The band tints the hair's hue and keeps its own
    light and dark, so the highlight carries the strands and shading instead of covering them,
    and it fades in softly towards the tip."""
    v = np.linspace(0, 1, rows)[:, None]
    u = np.arange(cols)[None, :]
    lum = out[..., :3].max(-1, keepdims=True)
    for s in h.get("streaks", []):
        x0, x1 = s["u"][0] * cols, s["u"][1] * cols
        centre, half = (x0 + x1) / 2, max(x1 - x0, 1) / 2
        across = np.exp(-((u - centre) / half) ** 2 * 2.5)
        along = np.clip((v - s["from"]) / s["fade"], 0, 1) ** 1.5
        w = (across * along * s["strength"])[..., None]
        hue = ramp(np.clip(s["levels"][0] + (s["levels"][1] - s["levels"][0]) * v, 0, 1), s["family"])
        hue = hue / np.maximum(hue.max(-1, keepdims=True), 1e-6)
        out[..., :3] = out[..., :3] * (1 - w) + hue * lum * w
    return out

def hair(a, hn, lay):
    """Every strand maps onto one shared strip of texture, root at the top and tip at the bottom,
    so each texel takes the colour of its place along the strand. Fibres and the fine dark lines
    between strands are drawn in, since the strip carries no strand detail of its own."""
    h = lay["hair"]
    rows, cols = a.shape[:2]
    f = fibres(cols, rows, h["seed"])
    shade = h["fibre_floor"] + (1 - h["fibre_floor"]) * f
    gaps = np.clip((h["gap"] - f) / h["gap"], 0, 1) * h["gap_depth"]
    v = np.linspace(0, 1, rows)[:, None]
    out = a.copy()
    out[..., :3] = strand_colour(h["stops"], v) * (shade * (1 - gaps))[..., None]
    return streaks(out, h, rows, cols)

def hair_strands(a, hn, lay):
    """A hair texture that already carries its own strand shading, root at the top: each texel
    takes the colour of its place along the strand, shaded by the texture's own light and dark."""
    h = lay["hair"]
    lum = a[..., :3].max(-1)
    inside = a[..., 3] > 0.5
    shade = h["fibre_floor"] + (1 - h["fibre_floor"]) * np.clip(lum / np.percentile(lum[inside], 99), 0, 1)
    v = np.linspace(0, 1, a.shape[0])[:, None]
    out = a.copy()
    out[..., :3] = strand_colour(h["stops"], v) * shade[..., None]
    return streaks(out, h, *a.shape[:2])

def hair_cap(a, hn, lay):
    """The scalp under the strands takes the root colour, keeping its own shading."""
    h = lay["hair"]
    lum = a[..., :3].max(-1)
    inside = a[..., 3] > 0.5
    shade = h["fibre_floor"] + (1 - h["fibre_floor"]) * np.clip(lum / np.percentile(lum[inside], 99), 0, 1)
    out = a.copy()
    out[..., :3] = np.where(inside[..., None], strand_colour(h["stops"], 0.0) * shade[..., None], a[..., :3])
    return out

def hair_glow(a, hn, lay):
    """The hair's emission: its highlight ring kept at a set strength, and, where the look asks
    for it, tips that light up like fibre optics, brightening towards the end of each strand
    with a strength that varies from strand to strand."""
    h = lay["hair"]
    out = a.copy()
    out[..., :3] = a[..., :3].max(-1, keepdims=True) * np.array(h["ring"])
    tips = h.get("tips")
    if tips:
        rows, cols = a.shape[:2]
        v = np.linspace(0, 1, rows)[:, None]
        u = np.linspace(0, 1, cols)[None, :]
        rise = np.clip((v - tips["from"]) / (1 - tips["from"]), 0, 1) ** tips["power"]
        strands = 0.55 + 0.45 * np.abs(np.sin(u * 61.0) * np.cos(u * 23.0 + 1.1))
        glow = (rise * strands)[..., None] * strand_colour(tips["stops"], v) * tips["strength"]
        out[..., :3] = np.clip(out[..., :3] + glow, 0, 1)
    return out

def fabric(a, hn, spec):
    """Turn a garment's neutral cloth into a colour family, keeping its folds and shading.

    Cloth is the unsaturated texels with value inside spec["value"], within spec["boxes"] where
    given; painted lines and trims are saturated and stay as they are. Each texel takes the family's colour at a level that runs from
    spec["levels"][0] at the garment's lowest point to [1] at its highest, scaled by the texel's
    own value against the cloth's median, so a fold keeps its depth.
    """
    s, v = hsv(a)
    lo_v, hi_v = spec["value"]
    cloth = (s < 0.2) & (v >= lo_v) & (v <= hi_v) & (a[..., 3] > 0.5)
    if "boxes" in spec:
        inside = np.zeros(v.shape, bool)
        for x0, y0, x1, y1 in spec["boxes"]:
            inside[y0:y1, x0:x1] = True
        cloth &= inside
    if not cloth.any():
        raise ValueError(f"no cloth texels in value range {spec['value']}")
    h0, h1 = np.percentile(hn[cloth], [2, 98])
    up = np.clip((hn - h0) / max(h1 - h0, 1e-6), 0, 1)
    lo, hi = spec["levels"]
    colour = ramp(lo + (hi - lo) * up, spec["family"])
    # Offset so that flat black cloth takes the colour evenly instead of dividing by zero.
    shade = np.clip((v + FABRIC_FLOOR) / (np.median(v[cloth]) + FABRIC_FLOOR), 0.35, 1.6)[..., None]
    out = a.copy()
    out[..., :3] = np.where(cloth[..., None], np.clip(colour * shade * spec["gain"], 0, 1), a[..., :3])
    return out

def recolour(a, hn, lay):
    """Turn a garment to one colour, keeping its folds: every opaque texel takes the target colour
    scaled by its own brightness against the garment's median."""
    spec = lay["recolour"]
    lum = a[..., :3].max(-1)
    inside = a[..., 3] > 0.5
    shade = np.clip(lum / np.median(lum[inside]), 0.4, 1.8)[..., None]
    out = a.copy()
    out[..., :3] = np.where(inside[..., None], np.clip(np.array(spec["colour"]) * shade, 0, 1), a[..., :3])
    return out

def boxes_mask(shape, boxes):
    m = np.zeros(shape, bool)
    for x0, y0, x1, y1 in boxes:
        m[y0:y1, x0:x1] = True
    return m

def accent_mask(a):
    """The garment's printed accent colour: warm saturated texels (the set's orange), including
    the antialiased fringe where an accent fades into black cloth."""
    s, v = hsv(a)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (s > 0.35) & (v > 0.06) & (r >= g) & (g >= b) & (r - b > 0.12) & (a[..., 3] > 0.5)

def techwear(a, hn, spec, lit):
    """Bring a bought techwear garment into the signature. Prints listed in "clear" are filled
    with the cloth around them; accent texels inside each "accents" box take a colour family,
    scaled by its "gain" and shaded by their own brightness so a print keeps its detail, and with "lit" turn into light;
    accent texels in a "solid" box become a plain colour keeping their shading; light grey
    texels in a "greys" box take a family; boxes in "lines" are drawn as lines of light."""
    out = a
    for box in spec.get("clear", []):
        out = fill_hole(out, box)
    acc = accent_mask(out)
    _, v = hsv(out)
    for item in spec.get("solid", []):
        m = boxes_mask(acc.shape, [item["box"]]) & acc
        out = out.copy()
        out[..., :3] = np.where(m[..., None], np.array(item["colour"]) * np.clip(v / np.percentile(v[m], 90), 0.3, 1.2)[..., None], out[..., :3])
    for item in spec.get("accents", []):
        m = boxes_mask(acc.shape, [item["box"]]) & acc
        if not m.any():
            raise ValueError(f"no accent texels in box {item['box']}")
        col = sweep(m, hn, m if item.get("wrap") else None, item["family"]) * item.get("gain", 1.0)
        out = out.copy()
        out[..., :3] = np.where(m[..., None], np.clip(col * np.clip(v / np.percentile(v[m], 90), 0, 1.15)[..., None], 0, 1), out[..., :3])
        if item.get("lit"):
            out = light(out, m & (v > 0.35), lit)
    s, v = hsv(out)
    for item in spec.get("greys", []):
        m = boxes_mask(v.shape, [item["box"]]) & (s < 0.2) & (v > item.get("min_v", 0.15)) & (out[..., 3] > 0.5)
        if not m.any():
            raise ValueError(f"no grey texels in box {item['box']}")
        out = paint(out, m, hn, lit=lit if item.get("lit") else None, family=item["family"])
    for x0, y0, x1, y1, family in spec.get("lines", []):
        m = boxes_mask(v.shape, [(x0, y0, x1, y1)]) & (out[..., 3] > 0.5)
        out = paint(out, m, hn, m, lit, family)
    return out

def parka(a, hn, lay):
    return techwear(a, hn, lay["parka"], lay["light"])

def cargo(a, hn, lay):
    return techwear(a, hn, lay["cargo"], lay["light"])

def sneakers(a, hn, lay):
    return techwear(a, hn, lay["sneakers"], lay["light"])

def front_mask(pmap, nmap, covered, polys, width=0.0):
    """Texels under polygons drawn in metres in the front view (x across, y up), on surfaces facing
    the front; with width, the polygons' outlines of that width instead."""
    xs = [p[0] for q in polys for p in q]
    ys = [p[1] for q in polys for p in q]
    ox, oy = min(xs) - 0.02, min(ys) - 0.02
    W, H = int((max(xs) - ox + 0.02) * 1000) + 1, int((max(ys) - oy + 0.02) * 1000) + 1
    canvas = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(canvas)
    for q in polys:
        pts = [((p[0] - ox) * 1000 * SS, (H - (p[1] - oy) * 1000) * SS) for p in q]
        if width:
            d.line(pts + pts[:1], fill=255, width=int(width * 1000 * SS), joint="curve")
        else:
            d.polygon(pts, fill=255)
    canvas = np.asarray(canvas.resize((W, H), Image.LANCZOS), float) / 255
    cx = ((pmap[..., 0] - ox) * 1000).astype(int)
    cy = (H - (pmap[..., 1] - oy) * 1000).astype(int)
    valid = covered & (nmap[..., 2] > 0.35) & (cx >= 0) & (cx < W) & (cy >= 0) & (cy < H)
    w = np.zeros(pmap.shape[:2])
    w[valid] = canvas[cy[valid], cx[valid]]
    return w

def layers(a, hn, lay, pmap, nmap, covered):
    """What Viet wears under his jacket, drawn on the body in body coordinates: a crew-neck
    sweatshirt with ribbed neck and hem, a white shirt whose collar points lie out over the
    neck rib, and the shirt's hem showing below the sweatshirt."""
    L = lay["layers"]
    x, y, z = pmap[..., 0], pmap[..., 1], pmap[..., 2]
    near_neck = np.abs(x) < L["neck_half"]
    top = np.where(near_neck, np.where(z > 0, L["neck_front"], L["neck_back"]), L["arm_top"])
    worn = covered & (np.abs(x) < L["wrist_x"]) & (y < top) & (y > L["shirt_hem"])
    sweat = worn & (y >= L["sweat_hem"])
    rib = sweat & ((near_neck & (y > top - L["rib"])) | (y < L["sweat_hem"] + L["rib"]))
    # Rib knit: fine vertical cords round the body.
    cords = 0.88 + 0.12 * (0.5 + 0.5 * np.sin(np.arctan2(x, z) * L["rib_cords"]))
    out = a.copy()
    out[..., :3] = np.where(sweat[..., None], np.array(L["sweat"]), out[..., :3])
    out[..., :3] = np.where(rib[..., None], np.array(L["rib_colour"]) * cords[..., None], out[..., :3])
    out[..., :3] = np.where((worn & ~sweat)[..., None], np.array(L["shirt"]), out[..., :3])
    edge = front_mask(pmap, nmap, covered, L["collar_points"], width=L["collar_edge"])[..., None]
    out[..., :3] = out[..., :3] * (1 - edge) + np.array(L["collar_edge_colour"]) * edge
    fill = front_mask(pmap, nmap, covered, L["collar_points"])[..., None]
    out[..., :3] = out[..., :3] * (1 - fill) + np.array(L["shirt"]) * fill
    out[..., 3] = np.where(worn, 1.0, out[..., 3])
    return socks(out, lay, pmap, nmap, covered) if "socks" in lay else out

def socks(a, lay, pmap, nmap, covered):
    """Knee-high knit socks from inside the shoe to under the shorts: fine cords round the leg,
    a ribbed band below the knee, and a stripe of light down the outside of each calf."""
    S = lay["socks"]
    x, y, z = pmap[..., 0], pmap[..., 1], pmap[..., 2]
    leg = covered & (y > S["bottom"]) & (y < S["top"]) & (np.abs(x) < S["half_width"])
    out = a.copy()
    cords = np.zeros(y.shape)
    for side in (-1, 1):
        m = leg & (np.sign(x) == side)
        xc, zc = x[m].mean(), z[m].mean()
        cords[m] = (0.5 + 0.5 * np.sin(np.arctan2(z - zc, x - xc) * S["cords"]))[m]
    knit = (1 - S["knit"] + S["knit"] * cords)[..., None]
    rib = leg & (y > S["rib"][0]) & (y < S["rib"][1])
    out[..., :3] = np.where(leg[..., None], np.array(S["colour"]) * knit, out[..., :3])
    rib_knit = (1 - 2 * S["knit"] + 2 * S["knit"] * cords)[..., None]
    out[..., :3] = np.where(rib[..., None], np.array(S["rib_colour"]) * rib_knit, out[..., :3])
    stripe = leg & ~rib & (y < S["rib"][0]) & (nmap[..., 0] * np.sign(x) > np.cos(S["stripe_half_angle"]))
    level = np.clip((y - S["bottom"]) / (S["rib"][0] - S["bottom"]), 0, 1)
    out[..., :3] = np.where(stripe[..., None], ramp(0.45 + 0.4 * level, S["stripe_family"]), out[..., :3])
    return light(out, stripe, lay["light"])

ROLES = {f.__name__: f for f in (recolour, hair, hair_strands, hair_cap, hair_glow, jacket, hoodie, collar, shirt_skirt, skirt, boots, body, tie, glow, cup_shell, ring, cup_plate, parka, cargo, sneakers, layers)}
NEEDS_COVERAGE = {ring, tie}
NEEDS_SURFACE = {layers}

def bands(a, pmap, covered, specs, lit):
    """Level lines of light round the body at set heights, such as a line above a boot's sole."""
    out = a
    for s in specs:
        m = covered & (np.abs(pmap[..., 1] - s["y"]) < s["width"] / 2)
        out = out.copy()
        out[..., :3] = np.where(m[..., None], ramp(np.full(m.shape, s["level"]), s["family"]), out[..., :3])
        out = light(out, m, lit)
    return out

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
    """Per material, each triangle's corner UVs (n, 3, 2) and corner positions (n, 3, 3)."""
    out = {}
    for mesh in gltf["meshes"]:
        for prim in mesh["primitives"]:
            uv = accessor(gltf, bin_, prim["attributes"]["TEXCOORD_0"]).astype(float)
            pos = accessor(gltf, bin_, prim["attributes"]["POSITION"]).astype(float)
            idx = accessor(gltf, bin_, prim["indices"]).reshape(-1, 3)
            uvs, ps = out.setdefault(prim["material"], ([], []))
            uvs.append(uv[idx])
            ps.append(pos[idx])
    return {m: (np.concatenate(u), np.concatenate(p)) for m, (u, p) in out.items()}

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
    jobs = [(key, role, "base") for key, role in lay["materials"].items()]
    jobs += [(key, role, "emissive") for key, role in lay.get("emissive_materials", {}).items()]
    for key, role, slot in jobs:
        i, fn = int(key), ROLES[role]
        mat = gltf["materials"][i]
        if slot == "base":
            holder, factor_key = mat["pbrMetallicRoughness"], "baseColorFactor"
            t = holder["baseColorTexture"]["index"]
        else:
            holder, factor_key = mat, "emissiveFactor"
            t = mat["emissiveTexture"]["index"]
        img = gltf["images"][gltf["textures"][t]["source"]]
        if img["bufferView"] in done:
            raise ValueError(f"material {i} shares an image already painted")
        done.add(img["bufferView"])
        im = Image.open(io.BytesIO(blobs[img["bufferView"]])).convert("RGBA")
        scale = lay.get("upscale", {}).get(key, 1)
        im = im.resize((im.width * scale, im.height * scale), Image.LANCZOS)
        a = np.asarray(im, float) / 255
        # The material's factor is baked into the texture, so painted colour renders exactly as drawn.
        a[..., :3] *= np.array(holder.get(factor_key, [1, 1, 1, 1])[:3])
        holder[factor_key] = [1, 1, 1, 1] if slot == "base" else [1, 1, 1]
        pmap, nmap, covered = surface_maps(*tris[i], a.shape[1], a.shape[0])
        hn = np.clip(pmap[..., 1] / BODY_HEIGHT_M, 0, 1)
        if fn in NEEDS_SURFACE:
            painted = fn(a, hn, lay, pmap, nmap, covered)
        else:
            painted = fn(a, hn, lay, covered) if fn in NEEDS_COVERAGE else fn(a, hn, lay)
        if slot == "base":
            for spec in lay.get("fabrics", {}).get(key, []):
                painted = fabric(painted, hn, spec)
            if key in lay.get("decals", {}):
                painted = decals(painted, pmap, nmap, covered, lay["decals"][key], lay["light"])
            if key in lay.get("bands", {}):
                painted = bands(painted, pmap, covered, lay["bands"][key], lay["light"])
            # A look can cut part of a garment away: texels inside these boxes become transparent.
            for x0, y0, x1, y1 in lay.get("cut", {}).get(key, []):
                painted[y0:y1, x0:x1, 3] = 0
        out = io.BytesIO()
        Image.fromarray((painted.clip(0, 1) * 255).round().astype(np.uint8)).save(out, "PNG")
        img["mimeType"] = "image/png"
        blobs[img["bufferView"]] = out.getvalue()
        print("painted material", i, slot)
    for key, fields in lay.get("mtoon", {}).items():
        gltf["materials"][int(key)]["extensions"]["VRMC_materials_mtoon"].update(fields)
    # A look can leave out a worn item: the mesh parts drawn with its materials are dropped.
    removed = {int(k) for k in lay.get("remove_materials", [])}
    for mesh in gltf["meshes"]:
        kept = [p for p in mesh["primitives"] if p["material"] not in removed]
        if not kept:
            raise ValueError(f"removing materials {sorted(removed)} would leave mesh {mesh.get('name')} empty")
        mesh["primitives"] = kept
    # Hair that hangs beside the arms is thrown outwards once the arms lower from the T-pose
    # through it, so a look can limit the hair's collision to the named groups.
    if "hair_collider_groups" in lay:
        sb = gltf["extensions"]["VRMC_springBone"]
        names = [g["name"] for g in sb["colliderGroups"]]
        missing = set(lay["hair_collider_groups"]) - set(names)
        if missing:
            raise ValueError(f"no collider groups named {sorted(missing)}")
        for spring in sb["springs"]:
            if spring.get("name") == "Hair":
                spring["colliderGroups"] = [g for g in spring.get("colliderGroups", []) if names[g] in lay["hair_collider_groups"]]
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
