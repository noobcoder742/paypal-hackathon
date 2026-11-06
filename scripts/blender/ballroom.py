"""Demo ballroom built in Blender and lit with Cycles.

A fictional 16.8 m x 20.6 m hotel ballroom, modelled from a reference sheet (panelled cream
walls, antique mirrors with a gold grid, crystal sconces, an acoustic-fabric head wall,
bronze double doors, a double coffered ceiling and a violet damask carpet). Dimensions not
given on the sheet are estimates for the demo; a LiDAR scan replaces them later.

Run with Blender as a Python module (pip install bpy):
  python scripts/blender/ballroom.py render  --out DIR [--views dollhouse,interior] [--samples 128] [--res 1600x900]
  python scripts/blender/ballroom.py bake    --out public/venues/demo-ballroom [--samples 256] [--size 2048]
  python scripts/blender/ballroom.py blend   --out DIR      (saves ballroom.blend to open in Blender)

Axes (Blender, Z up): X across the room (head wall at -X, entrance at +X), Y along the room.
The glTF export turns this into three.js axes: x = X, y = Z, z = -Y.
"""
import argparse
import math
import os
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
import textures  # noqa: E402

# ---------------------------------------------------------------- dimensions (metres)
W, L = 16.8, 20.6          # across (head wall -> entrance), along
H = 4.6                    # top of the cornice = the flat ceiling border
DADO = 0.95                # wainscot height (chair rail)
CORNICE = 4.15             # cornice starts here
UPPER = 5.0                # first ceiling recess
COFFER = 5.35              # inner coffers

# ---------------------------------------------------------------- materials


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def kelvin(k):
    """Approximate RGB (linear) of a black body at k kelvin."""
    t = k / 100
    r = 255 if t <= 66 else 329.7 * (t - 60) ** -0.1332
    g = 99.47 * math.log(t) - 161.1 if t <= 66 else 288.1 * (t - 60) ** -0.0755
    b = 255 if t >= 66 else (0 if t <= 19 else 138.5 * math.log(t - 10) - 305.0)
    return tuple(srgb('#%02x%02x%02x' % tuple(int(max(0, min(255, v))) for v in (r, g, b)))[:3])


MATS = {}


def mat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0, image=None, glass=False, spec=0.5):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = srgb(color) if isinstance(color, str) else color
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if 'Specular IOR Level' in p.inputs:
        p.inputs['Specular IOR Level'].default_value = spec
    if emit:
        p.inputs['Emission Color'].default_value = srgb(emit) if isinstance(emit, str) else emit
        p.inputs['Emission Strength'].default_value = strength
    if glass:
        p.inputs['Transmission Weight'].default_value = 1.0
        p.inputs['IOR'].default_value = 1.5
    if image is not None:
        img, scale = image
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        uv = nt.nodes.new('ShaderNodeUVMap')
        uv.uv_map = 'UVMap'
        nt.links.new(uv.outputs['UV'], tex.inputs['Vector'])
        nt.links.new(tex.outputs['Color'], p.inputs['Base Color'])
    m['web'] = 'glass' if glass else ('emit' if emit else ('metal' if metal > 0.5 else 'diffuse'))
    MATS[name] = m
    return m


def make_materials(tex_dir):
    os.makedirs(tex_dir, exist_ok=True)
    textures.save_png(textures.carpet(), os.path.join(tex_dir, 'carpet.png'))
    textures.save_png(textures.fabric(), os.path.join(tex_dir, 'fabric.png'))
    carpet = bpy.data.images.load(os.path.join(tex_dir, 'carpet.png'))
    fabric = bpy.data.images.load(os.path.join(tex_dir, 'fabric.png'))
    return {
        'wall': mat('Wall paint', '#e6ddd0', rough=0.6),
        'trim': mat('Moulding', '#efe9de', rough=0.45),
        'panel': mat('Raised panel', '#ebe4d8', rough=0.5),
        'ceiling': mat('Ceiling', '#f0ebe2', rough=0.8),
        'fabric': mat('Acoustic fabric', '#cfc2ad', rough=0.95, image=(fabric, 1)),
        'carpet': mat('Carpet', '#5a5470', rough=0.97, image=(carpet, 1), spec=0.2),
        'gold': mat('Brushed gold', (0.78, 0.56, 0.27, 1), rough=0.28, metal=1.0),
        'mirror': mat('Antique mirror', (0.62, 0.52, 0.40, 1), rough=0.06, metal=1.0),
        'bronze': mat('Bronze door', (0.42, 0.33, 0.24, 1), rough=0.35, metal=0.85),
        'crystal': mat('Crystal', (1, 0.97, 0.92, 1), rough=0.02, glass=True),
        'glow': mat('Sconce glow', '#fff1d8', emit='#ffdcae', strength=6.0),
        'downlight': mat('Downlight', '#ffffff', emit='#ffe6c4', strength=30.0),
        'led': mat('Cove LED', '#ffffff', emit='#fff0e0', strength=40.0),
        'exit': mat('Exit sign', '#0b8f4e', emit='#14b866', strength=4.0),
        'exit_text': mat('Exit text', '#ffffff', emit='#ffffff', strength=4.0),
        'slot': mat('Air slot', '#3a3633', rough=0.7),
        'shell': mat('Outer wall', '#d8cfc0', rough=0.9),
        'cut': mat('Wall top', '#2c2b2e', rough=0.9),
    }


# ---------------------------------------------------------------- geometry helpers

GROUPS = {}   # group name -> list of objects, joined at the end


def add(obj, group):
    GROUPS.setdefault(group, []).append(obj)
    return obj


def box(name, lo, hi, material, group, bevel=0.0):
    """Axis-aligned box from corner lo to hi (in the frame given by the current FRAME matrix)."""
    lo, hi = Vector(lo), Vector(hi)
    lo, hi = Vector(map(min, lo, hi)), Vector(map(max, lo, hi))
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    size = hi - lo
    for v in bm.verts:
        v.co = Vector((lo.x + (v.co.x + 0.5) * size.x, lo.y + (v.co.y + 0.5) * size.y, lo.z + (v.co.z + 0.5) * size.z))
    if bevel > 0 and min(size) > bevel * 2.5:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect='EDGES', profile=0.5)
    bm.transform(FRAME[0])
    _box_uv(bm)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(material)
    bpy.context.collection.objects.link(ob)
    return add(ob, group)


def quad(name, corners, material, group):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new(FRAME[0] @ Vector(c)) for c in corners]
    bm.faces.new(vs)
    _box_uv(bm)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(material)
    bpy.context.collection.objects.link(ob)
    return add(ob, group)


def cylinder(name, centre, radius, depth, material, group, axis='Z', verts=10):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=radius, radius2=radius, depth=depth)
    rot = {'Z': Matrix(), 'X': Matrix.Rotation(math.pi / 2, 4, 'Y'), 'Y': Matrix.Rotation(math.pi / 2, 4, 'X')}[axis]
    bm.transform(FRAME[0] @ Matrix.Translation(Vector(centre)) @ rot)
    _box_uv(bm)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(material)
    bpy.context.collection.objects.link(ob)
    return add(ob, group)


def _box_uv(bm):
    """Material UVs in metres (box projection) on the first UV layer."""
    uv = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = [(1, 2), (0, 2), (0, 1)][ax]
        for lp in f.loops:
            lp[uv].uv = (lp.vert.co[a], lp.vert.co[b])


FRAME = [Matrix()]


class wall_frame:
    """Local frame for building one wall: u along the wall (left to right seen from inside),
    v up, w out of the wall into the room."""

    def __init__(self, origin, inward, length):
        self.origin, self.inward, self.length = Vector(origin), Vector(inward).normalized(), length

    def __enter__(self):
        n = self.inward
        right = Vector((-n.y, n.x, 0))           # seen from inside, facing the wall
        m = Matrix.Identity(4)
        # local (u, v, w) -> world: origin + right*(u - L/2) + Z*v + n*w
        m.col[0][:3] = right
        m.col[1][:3] = (0, 0, 1)
        m.col[2][:3] = n
        m.col[3][:3] = self.origin - right * (self.length / 2)
        FRAME[0] = m
        return self

    def __exit__(self, *a):
        FRAME[0] = Matrix()


# ---------------------------------------------------------------- walls
# Bay sequences read off the reference elevations (widths in metres, left to right).
HEAD = [('pier', 1.2), ('mirror', 1.45), ('sconce', 0.9), ('mirror', 1.45), ('sconce', 0.75), ('pilaster', 0.55)]
HEAD = HEAD + [('niche', L - 2 * sum(w for _, w in HEAD))] + HEAD[::-1]
ENTRANCE = [('pier_deep', 1.0), ('panel', 2.2), ('pilaster', 0.5), ('door', 2.1), ('pilaster', 0.5)]
ENTRANCE = ENTRANCE + [('panel', L - 2 * sum(w for _, w in ENTRANCE))] + ENTRANCE[::-1]
SIDE = [('pier', 0.55), ('mirror', 0.85)] + [('sconce', 1.3), ('mirror', 1.875)] * 3 + [('sconce', 1.3), ('mirror', 0.85), ('pier', 0.55)]
# the side wall above has 3 full mirrors in the loop; insert the 4th to match the elevation
SIDE = [('pier', 0.55), ('mirror', 0.85)] + [('sconce', 1.3), ('mirror', 1.875)] * 4
SIDE = SIDE[:-1] + [('sconce', 1.3), ('mirror', 0.85), ('pier', 0.55)]

LIGHTS = []   # (kind, world position, extra)


def frame_bars(name, u0, u1, v0, v1, w, bar, depth, material, group):
    box(name + 'B', (u0, v0, w), (u1, v0 + bar, w + depth), material, group, bevel=0.004)
    box(name + 'T', (u0, v1 - bar, w), (u1, v1, w + depth), material, group, bevel=0.004)
    box(name + 'L', (u0, v0 + bar, w), (u0 + bar, v1 - bar, w + depth), material, group, bevel=0.004)
    box(name + 'R', (u1 - bar, v0 + bar, w), (u1, v1 - bar, w + depth), material, group, bevel=0.004)


def wall_plane(u0, u1, v0, v1, M, g, w=0.0):
    quad('wall', [(u0, v0, w), (u1, v0, w), (u1, v1, w), (u0, v1, w)], M['wall'], g)


def dado_panel(u0, u1, M, g, sockets=False):
    if u1 - u0 > 0.5:
        frame_bars('dado', u0 + 0.1, u1 - 0.1, 0.24, DADO - 0.16, 0.0, 0.035, 0.022, M['trim'], g)
    if sockets:
        mid = (u0 + u1) / 2
        for du in (-0.09, 0.09):
            box('socket', (mid + du - 0.06, 0.36, 0), (mid + du + 0.06, 0.44, 0.012), M['gold'], 'gold')


def build_wall(name, origin, inward, length, bays, M):
    g = 'wall_' + name
    with wall_frame(origin, inward, length):
        u = 0.0
        for i, (kind, bw) in enumerate(bays):
            u0, u1 = u, u + bw
            mid = (u0 + u1) / 2
            u = u1
            if kind == 'door':
                _door(u0, u1, M, g)
                continue
            if kind == 'niche':
                _niche(u0, u1, M, g, origin, inward, length)
                continue
            wall_plane(u0, u1, 0, H, M, g)
            if kind in ('pier', 'pier_deep'):
                d = 0.35 if kind == 'pier_deep' else 0.08
                box('pier', (u0, 0, 0), (u1, CORNICE, d), M['panel'], g, bevel=0.01)
                if bw > 0.5:
                    frame_bars('pierf', u0 + 0.14, u1 - 0.14, DADO + 0.15, 3.9, d, 0.04, 0.025, M['trim'], g)
                dado_panel(u0, u1, M, g, sockets=(kind == 'pier'))
            elif kind == 'pilaster':
                box('shaft', (u0 + 0.05, 0.3, 0), (u1 - 0.05, 3.85, 0.13), M['trim'], g, bevel=0.01)
                box('base', (u0 + 0.02, 0, 0), (u1 - 0.02, 0.3, 0.17), M['trim'], g, bevel=0.01)
                box('cap1', (u0 + 0.03, 3.85, 0), (u1 - 0.03, 3.98, 0.16), M['trim'], g, bevel=0.008)
                box('cap2', (u0, 3.98, 0), (u1, CORNICE, 0.19), M['trim'], g, bevel=0.008)
                for k in (-1, 1):   # two flutes
                    box('flute', (mid + k * 0.08 - 0.012, 0.45, 0.13), (mid + k * 0.08 + 0.012, 3.7, 0.137), M['panel'], g)
            elif kind == 'mirror':
                pad = 0.12
                box('mirror', (u0 + pad, DADO + 0.1, 0), (u1 - pad, 3.85, 0.012), M['mirror'], 'mirror')
                frame_bars('mframe', u0 + pad - 0.07, u1 - pad + 0.07, DADO + 0.03, 3.92, 0.0, 0.07, 0.05, M['trim'], g)
                cols = max(2, round((bw - 2 * pad) / 0.5))
                for c in range(1, cols):
                    x = u0 + pad + (bw - 2 * pad) * c / cols
                    box('grid', (x - 0.012, DADO + 0.1, 0.012), (x + 0.012, 3.85, 0.024), M['gold'], 'gold')
                rows = 5
                for r in range(1, rows):
                    y = DADO + 0.1 + (3.85 - DADO - 0.1) * r / rows
                    box('grid', (u0 + pad, y - 0.012, 0.012), (u1 - pad, y + 0.012, 0.024), M['gold'], 'gold')
                dado_panel(u0, u1, M, g)
            elif kind in ('sconce', 'panel'):
                inset = 0.1 if kind == 'sconce' else 0.22
                box('raised', (u0 + 0.04, DADO + 0.05, 0), (u1 - 0.04, 3.95, 0.035), M['panel'], g, bevel=0.006)
                frame_bars('pf', u0 + inset, u1 - inset, DADO + 0.2, 3.78, 0.035, 0.04, 0.025, M['trim'], g)
                frame_bars('pg', u0 + inset + 0.09, u1 - inset - 0.09, DADO + 0.29, 3.69, 0.035, 0.01, 0.012, M['gold'], 'gold')
                if kind == 'sconce':
                    _sconce(mid, 2.55, 0.035, M)
                dado_panel(u0, u1, M, g, sockets=(kind == 'panel' and bw < 3))
        # continuous mouldings: skirting, chair rail, cornice
        runs = _runs(bays)
        for a, b in runs:
            box('skirt', (a, 0, 0), (b, 0.15, 0.025), M['trim'], g, bevel=0.005)
            box('rail', (a, DADO - 0.05, 0), (b, DADO + 0.02, 0.045), M['trim'], g, bevel=0.008)
        steps = [(CORNICE, 4.25, 0.06), (4.25, 4.38, 0.11), (4.38, 4.5, 0.17), (4.5, H, 0.24)]
        for v0, v1, d in steps:
            box('cornice', (-0.3, v0, 0), (length + 0.3, v1, d), M['trim'], g, bevel=0.006)
        # outer shell (not baked): wall thickness and a dark cut on top, like a dollhouse section
        # (kept 0.32 m behind the wall face so it never overlaps the wall or the niche)
        box('shell', (-0.65, 0, -0.62), (length + 0.65, H + 0.9, -0.32), M['shell'], 'shell')
        box('cut', (-0.65, H + 0.9, -0.62), (length + 0.65, H + 0.92, 0), M['cut'], 'shell')
        quad('upper', [(-0.3, H, 0), (length + 0.3, H, 0), (length + 0.3, H + 0.9, 0), (-0.3, H + 0.9, 0)], M['wall'], 'shell')


def _runs(bays):
    """Wall spans not interrupted by doors."""
    runs, u, start = [], 0.0, 0.0
    for kind, bw in bays:
        if kind == 'door':
            runs.append((start, u))
            start = u + bw
        u += bw
    runs.append((start, u))
    return [(a, b) for a, b in runs if b - a > 0.01]


def _door(u0, u1, M, g):
    dw, dh = 1.7, 2.75
    mid = (u0 + u1) / 2
    a, b = mid - dw / 2, mid + dw / 2
    wall_plane(u0, a, 0, H, M, g)
    wall_plane(b, u1, 0, H, M, g)
    wall_plane(a, b, dh, H, M, g)
    # jambs and head of the opening
    box('jamb', (a, 0, -0.2), (a + 0.01, dh, 0), M['trim'], g)
    box('jamb', (b - 0.01, 0, -0.2), (b, dh, 0), M['trim'], g)
    box('head', (a, dh - 0.01, -0.2), (b, dh, 0), M['trim'], g)
    for k, (x0, x1) in enumerate(((a, mid - 0.004), (mid + 0.004, b))):
        box('leaf', (x0, 0, -0.12), (x1, dh, -0.06), M['bronze'], 'bronze', bevel=0.004)
        frame_bars('leafp', x0 + 0.12, x1 - 0.12, 0.25, dh - 0.25, -0.06, 0.03, 0.012, M['bronze'], 'bronze')
        hx = x1 - 0.07 if k == 0 else x0 + 0.07
        cylinder('handle', (hx, 1.2, -0.02), 0.014, 0.9, M['gold'], 'gold', axis='Z', verts=12)
        for hy in (0.82, 1.58):
            box('hpost', (hx - 0.01, hy - 0.01, -0.06), (hx + 0.01, hy + 0.01, -0.02), M['gold'], 'gold')
    frame_bars('arch', a - 0.14, b + 0.14, 0, dh + 0.14, 0, 0.14, 0.05, M['trim'], g)
    box('exit', (mid - 0.2, dh + 0.3, 0.0), (mid + 0.2, dh + 0.46, 0.06), M['exit'], 'emit')
    _exit_text(mid, dh + 0.38, 0.061, M)


def _exit_text(u, v, w, M):
    cu = bpy.data.curves.new('exit', 'FONT')
    cu.body = 'EXIT'
    cu.size = 0.09
    cu.align_x, cu.align_y = 'CENTER', 'CENTER'
    ob = bpy.data.objects.new('exit_text', cu)
    bpy.context.collection.objects.link(ob)
    ob.matrix_world = FRAME[0] @ Matrix.Translation((u, v, w)) @ Matrix.Rotation(math.pi / 2, 4, 'X') @ Matrix.Rotation(0, 4, 'Z')
    # FONT objects lie in local XY; rotate so the text faces into the room (local w)
    ob.matrix_world = FRAME[0] @ Matrix.Translation((u, v, w))
    ob.data.materials.append(M['exit_text'])
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    add(bpy.context.view_layer.objects.active, 'emit')


def _niche(u0, u1, M, g, origin, inward, length):
    depth, top = 0.3, 3.95
    wall_plane(u0, u1, 0, DADO, M, g)
    wall_plane(u0, u1, top, H, M, g)
    quad('nicheback', [(u0, DADO, -depth), (u1, DADO, -depth), (u1, top, -depth), (u0, top, -depth)], M['wall'], g)
    quad('sill', [(u0, DADO, 0), (u1, DADO, 0), (u1, DADO, -depth), (u0, DADO, -depth)], M['trim'], g)
    quad('soffit', [(u0, top, -depth), (u1, top, -depth), (u1, top, 0), (u0, top, 0)], M['ceiling'], g)
    quad('return', [(u0, DADO, -depth), (u0, DADO, 0), (u0, top, 0), (u0, top, -depth)], M['wall'], g)
    quad('return', [(u1, DADO, 0), (u1, DADO, -depth), (u1, top, -depth), (u1, top, 0)], M['wall'], g)
    box('fabric', (u0 + 0.06, DADO + 0.06, -depth), (u1 - 0.06, top - 0.08, -depth + 0.03), M['fabric'], g, bevel=0.01)
    frame_bars('nf', u0 - 0.12, u1 + 0.12, DADO - 0.04, top + 0.12, 0, 0.12, 0.06, M['trim'], g)
    dado_panel(u0, u1 / 2 + u0 / 2, M, g, sockets=True)
    dado_panel(u1 / 2 + u0 / 2, u1, M, g, sockets=True)
    n = 5
    for i in range(n):
        x = u0 + (u1 - u0) * (i + 0.5) / n
        cylinder('nichelight', (x, top - 0.005, -0.12), 0.04, 0.01, M['downlight'], 'emit', axis='Y')
        LIGHTS.append(('wash', FRAME[0] @ Vector((x, top - 0.02, -0.12)), FRAME[0].to_3x3() @ Vector((0, -1, -0.28))))


def _sconce(u, v, w, M):
    """Crystal sconce: gold backplate and three tiers of hanging crystal rods."""
    box('plate', (u - 0.07, v - 0.2, w), (u + 0.07, v + 0.24, w + 0.02), M['gold'], 'gold', bevel=0.005)
    tiers = ((0.19, v + 0.2, 0.26), (0.16, v + 0.04, 0.24), (0.12, v - 0.11, 0.2), (0.075, v - 0.24, 0.15))
    for t, (r, vy, ln) in enumerate(tiers):
        box('ring', (u - r, vy + ln / 2 - 0.006, w + 0.02), (u + r, vy + ln / 2 + 0.006, w + 0.02 + r), M['gold'], 'gold')
        k = 13 - t * 3
        for i in range(k):
            a = -math.pi * 0.45 + math.pi * 0.9 * i / (k - 1)
            cylinder('rod', (u + r * math.sin(a), vy - 0.02 * (i % 2), w + 0.03 + r * math.cos(a) * 0.9), 0.012, ln, M['crystal'], 'crystal', verts=6)
    cylinder('bulb', (u, v + 0.02, w + 0.08), 0.03, 0.3, M['glow'], 'emit', verts=10)
    LIGHTS.append(('sconce', FRAME[0] @ Vector((u, v + 0.02, w + 0.1)), None))


# ---------------------------------------------------------------- ceiling and floor

def build_ceiling(M):
    g = 'ceiling'
    FRAME[0] = Matrix()
    x1, y1 = 7.0, 8.9          # first recess (inset 1.4 m from the walls)
    hw, hl = W / 2, L / 2

    def plate(xa, xb, ya, yb, z, m=M['ceiling'], grp=g):
        quad('ceil', [(xa, ya, z), (xa, yb, z), (xb, yb, z), (xb, ya, z)], m, grp)   # faces down

    # flat border at H with a hole for the recess
    plate(-hw, hw, -hl, -y1, H)
    plate(-hw, hw, y1, hl, H)
    plate(-hw, -x1, -y1, y1, H)
    plate(x1, hw, -y1, y1, H)
    # cove: a lip at the edge of the border hides an LED strip lying on the border; the recess
    # walls are set back 0.45 m so the strip washes them and the upper ceiling with light
    lip, back = 0.1, 0.45
    for (a, b) in (((-x1, -y1), (x1, -y1 + 0.03)), ((-x1, y1 - 0.03), (x1, y1)), ((-x1, -y1), (-x1 + 0.03, y1)), ((x1 - 0.03, -y1), (x1, y1))):
        box('lip', (a[0], a[1], H), (b[0], b[1], H + lip), M['trim'], g)
    e = 0.08
    for (a, b) in (((-x1 - e, -y1 - e - 0.05), (x1 + e, -y1 - e)), ((-x1 - e, y1 + e), (x1 + e, y1 + e + 0.05)),
                   ((-x1 - e - 0.05, -y1 - e), (-x1 - e, y1 + e)), ((x1 + e, -y1 - e), (x1 + e + 0.05, y1 + e))):
        box('led', (a[0], a[1], H + 0.002), (b[0], b[1], H + 0.02), M['led'], 'ceil_emit')
    X, Y = x1 + back, y1 + back
    plate(-X, X, -Y, -y1, H + 0.001)   # top of the border inside the pocket
    plate(-X, X, y1, Y, H + 0.001)
    plate(-X, -x1, -y1, y1, H + 0.001)
    plate(x1, X, -y1, y1, H + 0.001)
    for xa, xb, ya, yb in ((-X, X, -Y, -Y), (-X, X, Y, Y), (-X, -X, -Y, Y), (X, X, -Y, Y)):
        quad('side', [(xa, ya, H), (xb, yb, H), (xb, yb, UPPER), (xa, ya, UPPER)], M['ceiling'], g)
    x1, y1 = X, Y
    # upper plane with two coffer holes (the coffers sit either side of a beam across the middle)
    cx0, cx1, cy = 0.45, 6.4, 8.2
    plate(-x1, x1, -y1, -cy, UPPER)
    plate(-x1, x1, cy, y1, UPPER)
    plate(-x1, -cx1, -cy, cy, UPPER)
    plate(cx1, x1, -cy, cy, UPPER)
    plate(-cx0, cx0, -cy, cy, UPPER)
    for sgn in (-1, 1):
        xa, xb = sorted((sgn * cx0, sgn * cx1))
        for (pa, pb) in (((xa, -cy), (xb, -cy)), ((xa, cy), (xb, cy)), ((xa, -cy), (xa, cy)), ((xb, -cy), (xb, cy))):
            quad('cside', [(pa[0], pa[1], UPPER), (pb[0], pb[1], UPPER), (pb[0], pb[1], COFFER), (pa[0], pa[1], COFFER)], M['ceiling'], g)
        plate(xa, xb, -cy, cy, COFFER)
        # two gold frames: on the coffer rim and inset on the coffer ceiling
        for (fa, fb, z, d) in (((xa - 0.06, -cy - 0.06), (xb + 0.06, cy + 0.06), UPPER - 0.03, 0.03), ((xa + 0.45, -cy + 0.45), (xb - 0.45, cy - 0.45), COFFER - 0.02, 0.02)):
            for (p, q) in (((fa[0], fa[1]), (fb[0], fa[1] + 0.06)), ((fa[0], fb[1] - 0.06), (fb[0], fb[1])), ((fa[0], fa[1]), (fa[0] + 0.06, fb[1])), ((fb[0] - 0.06, fa[1]), (fb[0], fb[1]))):
                box('cgold', (p[0], p[1], z), (q[0], q[1], z + d), M['gold'], 'ceil_gold')
        # downlights in the coffer: 3 x 7
        for i in range(3):
            for j in range(7):
                x = xa + (xb - xa) * (i + 0.5) / 3
                y = -cy + 2 * cy * (j + 0.5) / 7
                cylinder('dl', (x, y, COFFER - 0.006), 0.05, 0.01, M['downlight'], 'ceil_emit', verts=12)
                LIGHTS.append(('down', Vector((x, y, COFFER - 0.02)), None))
    # downlights around the border
    for y in np.linspace(-hl + 1.6, hl - 1.6, 8):
        for x in (-hw + 0.75, hw - 0.75):
            cylinder('dl', (x, y, H - 0.006), 0.05, 0.01, M['downlight'], 'ceil_emit', verts=12)
            LIGHTS.append(('down', Vector((x, y, H - 0.02)), None))
    for x in np.linspace(-hw + 2.2, hw - 2.2, 5):
        for y in (-hl + 0.75, hl - 0.75):
            cylinder('dl', (x, y, H - 0.006), 0.05, 0.01, M['downlight'], 'ceil_emit', verts=12)
            LIGHTS.append(('down', Vector((x, y, H - 0.02)), None))
    # linear air slots near the side walls
    for sy in (-1, 1):
        for xa, xb in ((-6.0, -1.6), (1.6, 6.0)):
            box('slot', (xa, sy * (hl - 0.55) - 0.05, H - 0.004), (xb, sy * (hl - 0.55) + 0.05, H), M['slot'], g)


def build_floor(M):
    FRAME[0] = Matrix()
    me = bpy.data.meshes.new('Floor')
    bm = bmesh.new()
    n = 8   # a few subdivisions so the lightmap UV isn't one stretched quad
    vs = [[bm.verts.new((-W / 2 + W * i / n, -L / 2 + L * j / n, 0)) for j in range(n + 1)] for i in range(n + 1)]
    for i in range(n):
        for j in range(n):
            bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for lp in f.loops:
            lp[uv].uv = (lp.vert.co.x / 2.6, lp.vert.co.y / 2.6)   # one carpet repeat per 2.6 m
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new('Floor', me)
    ob.data.materials.append(M['carpet'])
    bpy.context.collection.objects.link(ob)
    add(ob, 'floor')


# ---------------------------------------------------------------- lights

def build_lights(scale=1.0):
    for kind, pos, extra in LIGHTS:
        if kind == 'down':
            ld = bpy.data.lights.new('down', 'SPOT')
            ld.energy = 260 * scale
            ld.spot_size = math.radians(70)
            ld.spot_blend = 0.6
            ld.shadow_soft_size = 0.05
            ld.color = kelvin(4000)
            rot = Matrix()
        elif kind == 'wash':
            ld = bpy.data.lights.new('wash', 'SPOT')
            ld.energy = 160 * scale
            ld.spot_size = math.radians(55)
            ld.spot_blend = 0.5
            ld.shadow_soft_size = 0.03
            ld.color = kelvin(3800)
            d = extra.normalized()
            rot = d.to_track_quat('-Z', 'Y').to_matrix().to_4x4()
        else:
            ld = bpy.data.lights.new('sconce', 'POINT')
            ld.energy = 45 * scale
            ld.shadow_soft_size = 0.12
            ld.color = kelvin(3200)
            rot = Matrix()
        ob = bpy.data.objects.new(ld.name, ld)
        ob.matrix_world = Matrix.Translation(pos) @ rot
        bpy.context.collection.objects.link(ob)


# ---------------------------------------------------------------- scene

def build(tex_dir):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    GROUPS.clear()
    LIGHTS.clear()
    MATS.clear()
    M = make_materials(tex_dir)
    hw, hl = W / 2, L / 2
    build_wall('head', (-hw, 0, 0), (1, 0, 0), L, HEAD, M)
    build_wall('entrance', (hw, 0, 0), (-1, 0, 0), L, ENTRANCE, M)
    build_wall('left', (0, hl, 0), (0, -1, 0), W, SIDE, M)
    build_wall('right', (0, -hl, 0), (0, 1, 0), W, SIDE, M)
    build_ceiling(M)
    build_floor(M)
    build_lights()
    joined = {}
    for gname, objs in GROUPS.items():
        joined[gname] = join(objs, gname)
    return M, joined


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    # weld coincident vertices of the same part and fix normals
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def setup_cycles(samples, res=None):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except TypeError:
        pass
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 4
    sc.cycles.glossy_bounces = 4
    sc.cycles.transmission_bounces = 6
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 1.0
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    sc.view_settings.exposure = 0.0
    if res:
        sc.render.resolution_x, sc.render.resolution_y = res
        sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    w = bpy.data.worlds.new('World')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.55, 0.55, 0.58, 1)
    bg.inputs['Strength'].default_value = 0.8
    sc.world = w


VIEWS = {
    # name: (camera position, look-at, lens mm, hide ceiling)
    'dollhouse': ((19.0, -17.5, 21.0), (0.3, 0.3, 0.6), 30, True),
    'interior': ((7.4, 3.2, 1.65), (-8.4, -1.0, 2.3), 18, False),
    'mirrors': ((-4.5, 8.8, 1.7), (5.5, -10.3, 2.0), 20, False),
    'ceiling': ((6.5, 0, 1.4), (-2.0, 0.0, 5.2), 16, False),
    'detail': ((-6.4, 5.5, 1.2), (-6.4, 10.3, 1.0), 24, False),
}


def look(cam, eye, at):
    cam.location = eye
    d = Vector(at) - Vector(eye)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def render(out, views, samples, res):
    M, J = build(os.path.join(out, 'tex'))
    setup_cycles(samples, res)
    cd = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cd)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    for v in views:
        eye, at, lens, hide = VIEWS[v]
        cd.lens = lens
        look(cam, eye, at)
        for name in ('ceiling', 'ceil_gold', 'ceil_emit'):
            if name in J:
                J[name].visible_camera = not hide
        bpy.context.scene.render.filepath = os.path.join(out, f'{v}.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', v, flush=True)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['render', 'bake', 'blend'])
    ap.add_argument('--out', required=True)
    ap.add_argument('--views', default='dollhouse,interior')
    ap.add_argument('--samples', type=int, default=128)
    ap.add_argument('--res', default='1600x900')
    ap.add_argument('--size', type=int, default=2048)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    if a.mode == 'render':
        render(a.out, a.views.split(','), a.samples, tuple(int(x) for x in a.res.split('x')))
    elif a.mode == 'blend':
        build(os.path.join(a.out, 'tex'))
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.abspath(a.out), 'ballroom.blend'))
    else:
        import bake
        bake.run(a)
