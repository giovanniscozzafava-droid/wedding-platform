# -*- coding: utf-8 -*-
"""
Generatore parametrico dell'ALBUM in Blender (bpy, headless) → GLB per il configuratore.

    /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/album_gen.py -- \
        --out frontend/public/models/album --layouts all --formats all [--render]

Un GLB per (layout, formato). Geometria vera dove conta: piatti imbottiti con bordo arrotondato,
dorso tondo, blocco pagine con taglio, incassi foto con lastra lucida, fasce incassate, placche
in metallo, pietre. I MATERIALI hanno nomi fissi, così nel browser si sostituiscono a runtime:
  Cover     tessuto/legno della copertina (albedo + grana + tinta)
  Band      seconda superficie (fascia, taglio obliquo)
  Photo     lastra foto (la foto scelta va qui)
  Plate     placca metallo (ottone/nichel)
  Crystal   pietre
  Pages     taglio del blocco
  Decal     piano sottile sopra il piatto per nomi/logo (trasparente a runtime)
Unità: metri. L'album è centrato nell'origine, fronte verso +Z, dorso a -X.
"""
import bpy, bmesh, math, os, sys, argparse
from mathutils import Vector

# ----------------------------------------------------------------------------- parametri
FORMATS = {           # larghezza × altezza del piatto (cm) — proporzioni del catalogo
    'square': (30.0, 30.0),
    'landscape': (40.0, 30.0),
    'portrait': (30.0, 40.0),
}
LAYOUTS = ['plain', 'plate', 'monogram', 'fascia', 'fascia-ornament', 'oblique', 'swarovski-line',
           'swarovski-cluster', 'photo-vertical', 'photo-panoramic', 'photo-small', 'photo-full', 'photo-side', 'trilogy', 'print', 'laser']

BOARD_T = 0.45        # spessore piatto (cm)
PAD = 0.32            # imbottitura: raggio del bordo arrotondato (cm)
BLOCK_T = 2.6         # spessore blocco pagine (cm)
OVERHANG = 0.35       # sporgenza dei piatti oltre il blocco (cm)
SPINE_R = None        # calcolato: metà dello spessore totale

def cm(v): return v / 100.0

# ----------------------------------------------------------------------------- utilità mesh
def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)

def material(name, rgb=(0.8, 0.8, 0.8), rough=0.7, metal=0.0, alpha=1.0):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND'
    return m

MATS = {}
def mats():
    if MATS: return MATS
    MATS['Cover'] = material('Cover', (0.55, 0.42, 0.30), 0.75)
    MATS['Band'] = material('Band', (0.90, 0.88, 0.82), 0.6)
    MATS['Photo'] = material('Photo', (0.85, 0.85, 0.85), 0.15)
    MATS['Plate'] = material('Plate', (0.83, 0.68, 0.36), 0.28, 1.0)
    MATS['Crystal'] = material('Crystal', (0.95, 0.97, 1.0), 0.05, 0.0)
    MATS['Pages'] = material('Pages', (0.96, 0.94, 0.90), 0.9)
    MATS['Decal'] = material('Decal', (1, 1, 1), 0.6, 0.0, alpha=0.0)
    return MATS

def new_object(name, mesh, mat):
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    mesh.materials.append(mat)
    return ob

def rounded_box(name, w, h, d, r, mat, center=(0, 0, 0), segs=6):
    """Parallelepipedo con spigoli arrotondati (bevel), UV per faccia. w×h nel piano XY, d lungo Z."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= w; v.co.y *= h; v.co.z *= d
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(r, w / 2 * 0.98, h / 2 * 0.98, d / 2 * 0.98), segments=segs, profile=0.5, affect='EDGES')
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = new_object(name, me, mat)
    ob.location = Vector(center)
    smooth(ob)
    uv_box(ob)
    return ob

def smooth(ob):
    for p in ob.data.polygons: p.use_smooth = True
    if hasattr(ob.data, 'use_auto_smooth'): ob.data.use_auto_smooth = True     # Blender ≤ 4.0
    try:                                                                       # Blender ≥ 4.1: smooth per angolo
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True); bpy.context.view_layer.objects.active = ob
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    except Exception:
        pass

def uv_box(ob, scale=6.0):
    """UV a proiezione per faccia (box mapping), scala in metri → ripetizione della grana."""
    me = ob.data
    if not me.uv_layers: me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active.data
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if ax == 0: u, v = co.y, co.z
            elif ax == 1: u, v = co.x, co.z
            else: u, v = co.x, co.y
            uv[li].uv = (u * scale + 0.5, v * scale + 0.5)

def front_uv(ob, w, h):
    """UV 0..1 sulla faccia frontale (+Z) per foto/decal: x→u, y→v."""
    me = ob.data
    if not me.uv_layers: me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active.data
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = (co.x / w + 0.5, co.y / h + 0.5)

def plate(name, w, h, t, mat, center, r=None):
    return rounded_box(name, w, h, t, r if r is not None else min(w, h) * 0.06, mat, center, segs=4)

def recess(target, w, h, depth, center):
    """Incasso rettangolare nel piatto (boolean difference)."""
    cutter_mesh = bpy.data.meshes.new('cutter')
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co.x *= w; v.co.y *= h; v.co.z *= depth * 2
    bm.to_mesh(cutter_mesh); bm.free()
    cutter = bpy.data.objects.new('cutter', cutter_mesh); bpy.context.scene.collection.objects.link(cutter)
    cutter.location = Vector((center[0], center[1], center[2]))
    mod = target.modifiers.new('recess', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cutter; mod.solver = 'EXACT'
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

def stones(name, points, r, mat):
    """Pietre (sfere schiacciate) nei punti dati, in un'unica mesh."""
    bm = bmesh.new()
    for p in points:
        geom = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=r)
        for v in geom['verts']:
            v.co.z *= 0.55
            v.co += Vector(p)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = new_object(name, me, mat); smooth(ob)
    return ob

# ----------------------------------------------------------------------------- album
def build_album(layout, fmt):
    clean_scene(); MATS.clear(); M = mats()
    W, H = FORMATS[fmt]
    w, h = cm(W), cm(H)
    bt, pad, blk, oh = cm(BOARD_T), cm(PAD), cm(BLOCK_T), cm(OVERHANG)
    total = blk + 2 * bt
    zf = blk / 2 + bt / 2                      # centro del piatto frontale
    # piatti (fronte/retro) imbottiti: bordo arrotondato = imbottitura
    front = rounded_box('CoverFront', w, h, bt, pad, M['Cover'], (oh / 2, 0, zf))
    back = rounded_box('CoverBack', w, h, bt, pad, M['Cover'], (oh / 2, 0, -zf))
    # blocco pagine (leggermente più piccolo dei piatti), con il taglio a vista
    block = rounded_box('Pages', w - oh - cm(0.2), h - 2 * oh, blk, cm(0.05), M['Pages'], (oh / 2 + cm(0.1) - 0, 0, 0), segs=2)
    # dorso tondo: mezzo cilindro avvolgente lungo -X, alto quanto il piatto
    sp = bpy.data.meshes.new('Spine'); bm = bmesh.new()
    R = total / 2
    segs = 24
    prof = [(-w / 2 + oh / 2 - R * 0.02 + 0 + (R * math.cos(math.pi / 2 + math.pi * i / segs)), R * math.sin(math.pi / 2 + math.pi * i / segs)) for i in range(segs + 1)]
    verts_top = [bm.verts.new((x, h / 2 - pad * 0.2, z)) for x, z in prof]
    verts_bot = [bm.verts.new((x, -h / 2 + pad * 0.2, z)) for x, z in prof]
    for i in range(segs):
        bm.faces.new((verts_top[i], verts_top[i + 1], verts_bot[i + 1], verts_bot[i]))
    bm.to_mesh(sp); bm.free()
    spine = new_object('Spine', sp, M['Cover']); smooth(spine); uv_box(spine)
    # piano decal sopra il piatto frontale (nomi/logo a runtime)
    decal = rounded_box('Decal', w * 0.96, h * 0.96, cm(0.01), cm(0.001), M['Decal'], (oh / 2, 0, zf + bt / 2 + cm(0.02)), segs=1)
    front_uv(decal, w * 0.96, h * 0.96)

    z_top = zf + bt / 2                         # quota della superficie frontale
    cx = oh / 2
    def photo_window(name, x, y, pw, ph):
        recess(front, pw, ph, cm(0.25), (cx + x, y, z_top))
        p = plate(name, pw - cm(0.1), ph - cm(0.1), cm(0.2), M['Photo'], (cx + x, y, z_top - cm(0.15)), r=cm(0.05))
        front_uv(p, pw - cm(0.1), ph - cm(0.1))
    def band(x0, x1, y, bh, name='Band'):
        recess(front, x1 - x0, bh, cm(0.18), (cx + (x0 + x1) / 2, y, z_top))
        b = rounded_box(name, x1 - x0 - cm(0.05), bh - cm(0.05), cm(0.16), cm(0.03), M['Band'], (cx + (x0 + x1) / 2, y, z_top - cm(0.1)), segs=2)
        uv_box(b)
    def metal_plate(x, y, pw, ph, name='Plate'):
        plate(name, pw, ph, cm(0.12), M['Plate'], (cx + x, y, z_top + cm(0.05)), r=cm(0.15))
    def stone_line(x0, y0, x1, y1, n=None, r=cm(0.12)):
        L = math.hypot(x1 - x0, y1 - y0); n = n or max(2, int(L / cm(0.55)))
        pts = [(cx + x0 + (x1 - x0) * i / (n - 1), y0 + (y1 - y0) * i / (n - 1), z_top + cm(0.04)) for i in range(n)]
        stones('Crystal', pts, r, M['Crystal'])

    if layout == 'plate':
        metal_plate(0, 0, w * 0.32, h * 0.16)
    elif layout == 'fascia':                     # fascia orizzontale + linea pietre + targhetta (Claire/Plaza)
        band(-w / 2 + pad, w / 2 - pad, 0, h * 0.2)
        stone_line(-w * 0.42, 0, w * 0.12, 0)
        metal_plate(w * 0.24, 0, w * 0.34, h * 0.11)
    elif layout == 'fascia-ornament':            # fascia larga + doppia linea pietre (Thea/Comete)
        band(-w / 2 + pad, w / 2 - pad, h * 0.04, h * 0.22)
        stone_line(-w * 0.34, h * 0.14, w * 0.34, h * 0.14)
        stone_line(-w * 0.34, -h * 0.06, w * 0.34, -h * 0.06)
    elif layout == 'oblique':                    # taglio diagonale: seconda superficie in basso a destra (Almond)
        cut = bpy.data.meshes.new('obl'); bm = bmesh.new()
        p0 = bm.verts.new((-w / 2 - cm(1), -h / 2 - cm(1), z_top - cm(0.18))); p1 = bm.verts.new((w / 2 + cm(1), h * 0.12, z_top - cm(0.18)))
        p2 = bm.verts.new((w / 2 + cm(1), -h / 2 - cm(1), z_top - cm(0.18)))
        top = [bm.verts.new((v.co.x, v.co.y, z_top + cm(1))) for v in (p0, p1, p2)]
        bm.faces.new((p0, p1, p2)); bm.faces.new(tuple(reversed(top)))
        for a, b_ in ((0, 1), (1, 2), (2, 0)):
            bm.faces.new(((p0, p1, p2)[a], (p0, p1, p2)[b_], top[b_], top[a]))
        bm.to_mesh(cut); bm.free()
        cutter = bpy.data.objects.new('cutter', cut); bpy.context.scene.collection.objects.link(cutter)
        cutter.location.x = cx
        mod = front.modifiers.new('obl', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cutter; mod.solver = 'EXACT'
        bpy.context.view_layer.objects.active = front; bpy.ops.object.modifier_apply(modifier=mod.name)
        # il triangolo di seconda superficie
        band_mesh = bpy.data.meshes.new('Band'); bm = bmesh.new()
        q0 = bm.verts.new((-w / 2 + pad * 0.5, -h / 2 + pad * 0.5, z_top - cm(0.17))); q1 = bm.verts.new((w / 2 - pad * 0.5, h * 0.11, z_top - cm(0.17)))
        q2 = bm.verts.new((w / 2 - pad * 0.5, -h / 2 + pad * 0.5, z_top - cm(0.17)))
        t2 = [bm.verts.new((v.co.x, v.co.y, z_top - cm(0.02))) for v in (q0, q1, q2)]
        bm.faces.new((q0, q1, q2)); bm.faces.new(tuple(reversed(t2)))
        for a, b_ in ((0, 1), (1, 2), (2, 0)): bm.faces.new(((q0, q1, q2)[a], (q0, q1, q2)[b_], t2[b_], t2[a]))
        bm.to_mesh(band_mesh); bm.free()
        bob = new_object('Band', band_mesh, M['Band']); bob.location.x = cx; uv_box(bob)
        bpy.data.objects.remove(cutter, do_unlink=True)
        stone_line(-w * 0.5 + pad, -h * 0.5 + pad + (h * 0.12 + h * 0.5 - pad) * 0.0 + cm(0.0), w * 0.5 - pad, h * 0.11, n=int(w / cm(0.55)))
    elif layout == 'swarovski-line':             # linea verticale di pietre + targhetta (Diez)
        stone_line(w * 0.1, -h * 0.38, w * 0.1, h * 0.38)
        metal_plate(-w * 0.16, 0, w * 0.36, h * 0.11)
    elif layout == 'swarovski-cluster':          # grappolo di pietre (Bouquet/Ninfea/Xante)
        import random
        random.seed(7)
        pts = []
        for i in range(26):
            a = random.random() * math.tau; rr = random.random() ** 0.5 * min(w, h) * 0.16
            pts.append((cx + math.cos(a) * rr, h * 0.1 + math.sin(a) * rr * 0.8, z_top + cm(0.04)))
        stones('Crystal', pts, cm(0.11), M['Crystal'])
    elif layout == 'photo-vertical':
        photo_window('Photo', w * 0.08, 0, w * 0.38, h * 0.58)
    elif layout == 'photo-panoramic':
        photo_window('Photo', 0, h * 0.08, w * 0.76, h * 0.28)
    elif layout == 'photo-small':
        photo_window('Photo', w * 0.1, h * 0.08, w * 0.3, h * 0.24)
    elif layout == 'photo-full':
        photo_window('Photo', 0, 0, w * 0.94, h * 0.94)
    elif layout == 'photo-side':                 # Azulejo: foto a tutta altezza sul 55% destro, pannello Cristalplex (decal) a sinistra
        photo_window('Photo', w * 0.225, 0, w * 0.55, h * 0.96)
    elif layout == 'trilogy':
        pw = w * 0.2; gap = w * 0.04
        for i in (-1, 0, 1): photo_window(f'Photo{i + 2}', i * (pw + gap), h * 0.05, pw, pw)
    elif layout == 'laser':                      # lastra Cristalwhite sopra il piatto (Dream/Betulla): il decoro va nel decal
        p = plate('Band', w * 0.92, h * 0.92, cm(0.15), M['Band'], (cx, 0, z_top + cm(0.07)), r=cm(0.08)); front_uv(p, w * 0.92, h * 0.92)
    # 'plain', 'monogram', 'print': solo decal a runtime
    return front

def export(path):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_materials='EXPORT', export_normals=True, export_texcoords=True, use_selection=True)

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'public', 'textures')

def image_tex(mat, img_path, socket='Base Color', scale=1.0, colorspace='sRGB', strength=None):
    """Aggiunge una texture immagine a un materiale Principled (con mapping ripetuto)."""
    nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
    img = bpy.data.images.load(img_path); img.colorspace_settings.name = colorspace
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
    mapping = nt.nodes.new('ShaderNodeMapping'); coord = nt.nodes.new('ShaderNodeTexCoord')
    mapping.inputs['Scale'].default_value = (scale, scale, scale)
    nt.links.new(coord.outputs['UV'], mapping.inputs['Vector']); nt.links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
    if socket == 'Normal':
        bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = strength or 0.35
        nt.links.new(tex.outputs['Color'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        nt.links.new(tex.outputs['Color'], bsdf.inputs[socket])

PBR = os.path.join(TEX, 'pbr')
def pbr_set(mat, fam, tint=None, scale=None, strength=0.6, rough_default=0.8):
    """Applica il set PBR del materiale del catalogo (color·normal·rough di public/textures/pbr/<fam>)."""
    d = os.path.join(PBR, fam)
    nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
    sc = scale or {'pelle': 4, 'skill': 5, 'crazy': 4, 'alcantara': 6, 'suade': 5, 'velu-arte': 6, 'juta': 5, 'safir': 8, 'sequoia': 7, 'soft-touch': 4, 'metal': 8, 'acero': 2.5, 'wood': 2, 'cristalwhite': 3, 'cristalplex': 3}.get(fam, 5)
    sc = sc / 6.0           # le UV del generatore ripetono 6 volte al metro
    if os.path.exists(os.path.join(d, 'color.jpg')):
        image_tex(mat, os.path.join(d, 'color.jpg'), 'Base Color', scale=sc)
        if tint:
            tex = [n for n in nt.nodes if n.type == 'TEX_IMAGE'][-1]
            mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
            mix.inputs[7].default_value = (*tint, 1)
            nt.links.new(tex.outputs['Color'], mix.inputs[6]); nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    if os.path.exists(os.path.join(d, 'normal.jpg')):
        img = bpy.data.images.load(os.path.join(d, 'normal.jpg')); img.colorspace_settings.name = 'Non-Color'
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
        mp = nt.nodes.new('ShaderNodeMapping'); co = nt.nodes.new('ShaderNodeTexCoord'); mp.inputs['Scale'].default_value = (sc, sc, sc)
        nt.links.new(co.outputs['UV'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = strength
        nt.links.new(t.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    if os.path.exists(os.path.join(d, 'rough.jpg')):
        image_tex(mat, os.path.join(d, 'rough.jpg'), 'Roughness', scale=sc, colorspace='Non-Color')
    else:
        bsdf.inputs['Roughness'].default_value = rough_default

def dress_preview(preset):
    """Materiali di anteprima con i set PBR veri: 'wood' (noce) oppure 'alcantara' (bluette)."""
    M = mats()
    cov = M['Cover'].node_tree.nodes['Principled BSDF']
    if preset == 'wood':
        pbr_set(M['Cover'], 'wood', strength=0.35)
        # l'albedo è la foto dell'essenza
        nt = M['Cover'].node_tree
        for n in [n for n in nt.nodes if n.type == 'TEX_IMAGE' and 'color' in (n.image.filepath if n.image else '')]:
            n.image = bpy.data.images.load(os.path.join(TEX, 'wood', 'noce.jpg')); n.image.colorspace_settings.name = 'sRGB'
        if 'Coat Weight' in cov.inputs: cov.inputs['Coat Weight'].default_value = 0.35; cov.inputs['Coat Roughness'].default_value = 0.25
    else:
        pbr_set(M['Cover'], 'alcantara', tint=(0.11, 0.33, 0.40), strength=0.5)
        if 'Sheen Weight' in cov.inputs: cov.inputs['Sheen Weight'].default_value = 0.6
    pbr_set(M['Band'], 'alcantara', tint=(0.93, 0.90, 0.84), strength=0.45)
    pl = M['Plate'].node_tree.nodes['Principled BSDF']
    pl.inputs['Base Color'].default_value = (0.90, 0.76, 0.42, 1); pl.inputs['Metallic'].default_value = 1.0; pl.inputs['Roughness'].default_value = 0.22
    cr = M['Crystal'].node_tree.nodes['Principled BSDF']
    cr.inputs['Base Color'].default_value = (1, 1, 1, 1); cr.inputs['Roughness'].default_value = 0.03
    if 'Transmission Weight' in cr.inputs: cr.inputs['Transmission Weight'].default_value = 0.6
    cr.inputs['IOR'].default_value = 1.8
    if 'Coat Weight' in cr.inputs: cr.inputs['Coat Weight'].default_value = 1.0
    ph = M['Photo'].node_tree.nodes['Principled BSDF']
    demo = os.path.join(TEX, 'demo', 'couple.jpg')
    if os.path.exists(demo): image_tex(M['Photo'], demo, 'Base Color', scale=1.0)
    ph.inputs['Roughness'].default_value = 0.08
    if 'Coat Weight' in ph.inputs: ph.inputs['Coat Weight'].default_value = 1.0
    pg = M['Pages'].node_tree.nodes['Principled BSDF']; pg.inputs['Roughness'].default_value = 0.9

def render_preview(path, fmt, engine='CYCLES', samples=96, preset='wood'):
    """Anteprima fotorealistica della scena (controllo del generatore)."""
    dress_preview(preset)
    scene = bpy.context.scene
    scene.render.engine = engine
    if engine == 'CYCLES':
        scene.cycles.samples = samples; scene.cycles.use_denoising = True
        try:
            prefs = bpy.context.preferences.addons['cycles'].preferences
            prefs.compute_device_type = 'METAL'; prefs.get_devices()
            for d in prefs.devices: d.use = True
            scene.cycles.device = 'GPU'
        except Exception: pass
    scene.render.resolution_x = 1100; scene.render.resolution_y = 800; scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
    scene.view_settings.exposure = -0.3
    world = bpy.data.worlds.new('W'); scene.world = world; world.use_nodes = True
    bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.80, 0.78, 0.74, 1); bg.inputs['Strength'].default_value = 0.35
    # tavolo su cui poggia l'album
    tbl = bpy.data.meshes.new('Table'); bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=2.0); bm.to_mesh(tbl); bm.free()
    tob = bpy.data.objects.new('Table', tbl); scene.collection.objects.link(tob); tob.location.z = -(cm(BLOCK_T) / 2 + cm(BOARD_T) + cm(0.02))
    tm = material('Table', (0.86, 0.84, 0.80), 0.7); tob.data.materials.append(tm)
    cam = bpy.data.cameras.new('Cam'); camob = bpy.data.objects.new('Cam', cam); scene.collection.objects.link(camob)
    W, H = FORMATS[fmt]; d = cm(max(W, H)) * 1.9
    camob.location = (d * 0.55, -d * 0.95, d * 0.75); cam.lens = 70
    tr = camob.constraints.new('TRACK_TO'); tgt = bpy.data.objects.new('Tgt', None); scene.collection.objects.link(tgt); tgt.location = (0, 0, 0)
    tr.target = tgt; tr.track_axis = 'TRACK_NEGATIVE_Z'; tr.up_axis = 'UP_Y'
    scene.camera = camob
    key = bpy.data.lights.new('Key', 'AREA'); key.energy = 45; key.size = 0.9; key.color = (1.0, 0.96, 0.90)
    kob = bpy.data.objects.new('Key', key); scene.collection.objects.link(kob); kob.location = (0.35, -0.45, 0.75)
    trk = kob.constraints.new('TRACK_TO'); trk.target = tgt; trk.track_axis = 'TRACK_NEGATIVE_Z'; trk.up_axis = 'UP_Y'
    fill = bpy.data.lights.new('Fill', 'AREA'); fill.energy = 14; fill.size = 1.6; fill.color = (0.90, 0.94, 1.0)
    fob = bpy.data.objects.new('Fill', fill); scene.collection.objects.link(fob); fob.location = (-0.7, -0.1, 0.5)
    trf = fob.constraints.new('TRACK_TO'); trf.target = tgt; trf.track_axis = 'TRACK_NEGATIVE_Z'; trf.up_axis = 'UP_Y'
    rim = bpy.data.lights.new('Rim', 'AREA'); rim.energy = 25; rim.size = 0.6
    rob = bpy.data.objects.new('Rim', rim); scene.collection.objects.link(rob); rob.location = (-0.2, 0.7, 0.6)
    trr = rob.constraints.new('TRACK_TO'); trr.target = tgt; trr.track_axis = 'TRACK_NEGATIVE_Z'; trr.up_axis = 'UP_Y'
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser(); ap.add_argument('--out', required=True); ap.add_argument('--layouts', default='all'); ap.add_argument('--formats', default='all'); ap.add_argument('--render', action='store_true'); ap.add_argument('--preset', default='wood'); ap.add_argument('--samples', type=int, default=96)
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    layouts = LAYOUTS if a.layouts == 'all' else a.layouts.split(',')
    formats = list(FORMATS) if a.formats == 'all' else a.formats.split(',')
    for lay in layouts:
        for fmt in formats:
            build_album(lay, fmt)
            # niente camera/luci nel GLB: si esporta prima del render
            export(os.path.join(a.out, f'{lay}--{fmt}.glb'))
            if a.render: render_preview(os.path.join(a.out, f'{lay}--{fmt}.png'), fmt, samples=a.samples, preset=a.preset)
            print('OK', lay, fmt)
