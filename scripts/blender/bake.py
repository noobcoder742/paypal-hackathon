"""Bake the ballroom's Cycles lighting into lightmaps and export a web-ready GLB.

Output (in --out):
  room.glb          geometry + materials, 2 UV sets (materials, lightmap)
  lm-<part>.webp    baked diffuse light per part (walls, ceiling, floor), sRGB-encoded / scale
  env.jpg           360-degree panorama from the middle of the room (reflections for mirrors/gold)
  room.json         lightmap scales and room facts for the studio
Static parts get Cycles' light (soft shadows, bounce light, sconce glows) for free at runtime:
the studio just multiplies colour by the lightmap. Movable furniture uses real-time lights.
"""
import json
import math
import os

import bpy
import bmesh
import numpy as np
from mathutils import Vector

import ballroom as B

BAKED = ['floor', 'wall_head', 'wall_entrance', 'wall_left', 'wall_right', 'ceiling']


def lightmap_uv(ob):
    me = ob.data
    if ob.name == 'floor':
        bm = bmesh.new()
        bm.from_mesh(me)
        lay = bm.loops.layers.uv.new('lightmap')
        for f in bm.faces:
            for lp in f.loops:
                lp[lay].uv = ((lp.vert.co.x + B.W / 2) / B.W, (lp.vert.co.y + B.L / 2) / B.L)
        bm.to_mesh(me)
        bm.free()
        me.uv_layers['lightmap'].active = True
        return
    lay = me.uv_layers.new(name='lightmap')
    me.uv_layers.active = lay
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, margin=0.0025)
    bpy.ops.object.mode_set(mode='OBJECT')


def bake_part(ob, size, samples):
    img = bpy.data.images.new('lm-' + ob.name, size, size, float_buffer=True, alpha=False)
    for slot in ob.material_slots:
        nt = slot.material.node_tree
        node = nt.nodes.get('BakeTarget') or nt.nodes.new('ShaderNodeTexImage')
        node.name = 'BakeTarget'
        node.image = img
        nt.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.context.scene.cycles.samples = samples
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=12, margin_type='EXTEND',
                        use_clear=True, uv_layer='lightmap', target='IMAGE_TEXTURES')
    px = np.empty(size * size * 4, np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(size, size, 4)[::-1, :, :3]   # Blender stores rows bottom-up


def denoise(a):
    """Intel Open Image Denoise (shipped inside the bpy package), called through its C API.
    Falls back to a light blur if the library can't be loaded."""
    import ctypes
    path = next((os.path.join(d, 'lib', 'libOpenImageDenoise.so.2') for d in _parents(bpy.__file__)
                 if os.path.exists(os.path.join(d, 'lib', 'libOpenImageDenoise.so.2'))), None)
    try:
        oidn = ctypes.CDLL(path)
    except (OSError, TypeError):
        print('OIDN not found; blurring instead', flush=True)
        return _blur(a)
    vp = ctypes.c_void_p
    for fn, res in (('oidnNewDevice', vp), ('oidnNewFilter', vp)):
        getattr(oidn, fn).restype = res
    oidn.oidnNewFilter.argtypes = [vp, ctypes.c_char_p]
    oidn.oidnSetSharedFilterImage.argtypes = [vp, ctypes.c_char_p, vp, ctypes.c_int, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t]
    oidn.oidnSetFilterBool.argtypes = [vp, ctypes.c_char_p, ctypes.c_bool]
    for fn in ('oidnCommitDevice', 'oidnCommitFilter', 'oidnExecuteFilter', 'oidnReleaseFilter', 'oidnReleaseDevice'):
        getattr(oidn, fn).argtypes = [vp]
    dev = oidn.oidnNewDevice(0)
    oidn.oidnCommitDevice(dev)
    src = np.ascontiguousarray(a, np.float32)
    dst = np.empty_like(src)
    h, w = src.shape[:2]
    f = oidn.oidnNewFilter(dev, b'RT')
    FLOAT3 = 3
    oidn.oidnSetSharedFilterImage(f, b'color', src.ctypes.data, FLOAT3, w, h, 0, 0, 0)
    oidn.oidnSetSharedFilterImage(f, b'output', dst.ctypes.data, FLOAT3, w, h, 0, 0, 0)
    oidn.oidnSetFilterBool(f, b'hdr', True)
    oidn.oidnCommitFilter(f)
    oidn.oidnExecuteFilter(f)
    oidn.oidnReleaseFilter(f)
    oidn.oidnReleaseDevice(dev)
    print('denoised with OIDN', flush=True)
    return dst


def _parents(p):
    p = os.path.abspath(p)
    while os.path.dirname(p) != p:
        p = os.path.dirname(p)
        yield p


def _blur(a, sigma=1.4):
    r = int(sigma * 3)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    for axis in (0, 1):
        a = np.apply_along_axis(lambda m: np.convolve(m, k, mode='same'), axis, a)
    return a


def encode(a, path):
    """Store light / scale as sRGB 8-bit so the dark end keeps its precision."""
    from PIL import Image
    scale = float(np.percentile(a, 99.7)) or 1.0
    x = np.clip(a / scale, 0, 1)
    s = np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)
    Image.fromarray((s * 255 + 0.5).astype(np.uint8)).save(path, quality=88, method=6)
    return scale


def panorama(out, samples):
    cd = bpy.data.cameras.new('pano')
    cd.type = 'PANO'
    try:
        cd.panorama_type = 'EQUIRECTANGULAR'
    except AttributeError:
        cd.cycles.panorama_type = 'EQUIRECTANGULAR'
    cam = bpy.data.objects.new('pano', cd)
    bpy.context.collection.objects.link(cam)
    cam.location = (0, 0, 1.7)
    cam.rotation_euler = (math.pi / 2, 0, -math.pi / 2)   # looking along +X (three.js +x)
    sc = bpy.context.scene
    sc.camera = cam
    sc.cycles.samples = samples
    sc.render.resolution_x, sc.render.resolution_y = 1536, 768
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = 85
    sc.render.filepath = os.path.join(out, 'env.jpg')
    bpy.ops.render.render(write_still=True)


def run(a):
    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    M, J = B.build(os.path.join(out, '..', '..', '..', 'build', 'ballroom-tex'))
    B.setup_cycles(a.samples)
    sc = bpy.context.scene
    sc.render.bake.use_selected_to_active = False
    scales = {}
    for name in BAKED:
        ob = J[name]
        lightmap_uv(ob)
        size = a.size if name in ('floor', 'ceiling', 'wall_head', 'wall_entrance') else a.size // 2 * 2
        print('baking', name, size, flush=True)
        light = denoise(bake_part(ob, size, a.samples))
        scales[name] = encode(light, os.path.join(out, f'lm-{name}.webp'))
    # the bake target nodes are unlinked, so the exporter ignores them; drop them anyway
    for m in bpy.data.materials:
        if m.node_tree and 'BakeTarget' in m.node_tree.nodes:
            m.node_tree.nodes.remove(m.node_tree.nodes['BakeTarget'])
    # parts without textures don't need material UVs: smaller download
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name not in ('floor', 'wall_head') and 'UVMap' in o.data.uv_layers:
            o.data.uv_layers.remove(o.data.uv_layers['UVMap'])
    for o in bpy.data.objects:
        o.select_set(o.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'room.glb'), export_format='GLB', use_selection=True,
                              export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_image_format='WEBP', export_cameras=False, export_lights=False,
                              export_extras=True, export_yup=True, export_apply=True)
    panorama(out, 24)
    json.dump({'lightmaps': {k: {'file': f'lm-{k}.webp', 'scale': round(v, 4)} for k, v in scales.items()},
               'env': 'env.jpg', 'glb': 'room.glb',
               'dimensions': {'length': B.W, 'width': B.L, 'height': B.H, 'ceiling': B.COFFER}},
              open(os.path.join(out, 'room.json'), 'w'), indent=1)
    print('done', out, flush=True)
